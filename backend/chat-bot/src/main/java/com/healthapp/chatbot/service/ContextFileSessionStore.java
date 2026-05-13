package com.healthapp.chatbot.service;

import com.healthapp.chatbot.model.ContextFilePayload;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ContextFileSessionStore {

    private final long maxFileBytes;
    private final int chunkSizeChars;
    private final int maxFilesPerSession;
    private final int maxResultsPerSearch;

    private final Map<String, LinkedHashMap<String, StoredContextFile>> store = new ConcurrentHashMap<>();

    public ContextFileSessionStore(
            @Value("${app.chatbot.context-files.max-bytes:3145728}") long maxFileBytes,
            @Value("${app.chatbot.context-files.chunk-size-chars:1200}") int chunkSizeChars,
            @Value("${app.chatbot.context-files.max-files-per-session:6}") int maxFilesPerSession,
            @Value("${app.chatbot.context-files.search-max-results:3}") int maxResultsPerSearch
    ) {
        this.maxFileBytes = maxFileBytes;
        this.chunkSizeChars = chunkSizeChars;
        this.maxFilesPerSession = maxFilesPerSession;
        this.maxResultsPerSearch = maxResultsPerSearch;
    }

    public String upsertFiles(String sessionId, List<ContextFilePayload> files) {
        if (sessionId == null || sessionId.isBlank() || files == null || files.isEmpty()) {
            return "";
        }

        LinkedHashMap<String, StoredContextFile> sessionFiles = store.computeIfAbsent(sessionId, key -> new LinkedHashMap<>());
        int registered = 0;

        for (ContextFilePayload payload : files) {
            if (payload == null) {
                continue;
            }
            String name = sanitize(payload.name());
            String content = payload.content() == null ? "" : payload.content();
            if (name.isBlank() || content.isBlank()) {
                continue;
            }

            long measuredSizeBytes = payload.sizeBytes() != null
                    ? payload.sizeBytes()
                    : content.getBytes(StandardCharsets.UTF_8).length;

            if (measuredSizeBytes > maxFileBytes) {
                throw new IllegalArgumentException("Le fichier " + name + " depasse la taille maximale autorisee de " + maxFileBytes + " octets.");
            }

            List<String> chunks = chunkContent(content);
            sessionFiles.put(name, new StoredContextFile(
                    name,
                    sanitize(payload.contentType()),
                    measuredSizeBytes,
                    Instant.now(),
                    chunks
            ));
            registered++;
        }

        while (sessionFiles.size() > maxFilesPerSession) {
            String oldestKey = sessionFiles.keySet().iterator().next();
            sessionFiles.remove(oldestKey);
        }

        return registered > 0 ? (registered + " fichier(s) de contexte disponibles dans la session.") : "";
    }

    public String search(String sessionId, String query, String fileName) {
        LinkedHashMap<String, StoredContextFile> sessionFiles = store.get(sessionId);
        if (sessionFiles == null || sessionFiles.isEmpty()) {
            return "Aucun fichier de contexte disponible pour cette session.";
        }

        String normalizedQuery = sanitize(query).toLowerCase(Locale.ROOT);
        String requestedFile = sanitize(fileName).toLowerCase(Locale.ROOT);

        List<StoredContextFile> candidates = sessionFiles.values().stream()
                .filter(file -> requestedFile.isBlank() || file.name().toLowerCase(Locale.ROOT).contains(requestedFile))
                .toList();

        if (candidates.isEmpty()) {
            return "Aucun fichier de contexte correspondant au filtre fourni.";
        }

        if (normalizedQuery.isBlank()) {
            StringBuilder summary = new StringBuilder("Fichiers de contexte disponibles:\n");
            for (StoredContextFile file : candidates) {
                summary.append("- ")
                        .append(file.name())
                        .append(" (chunks=")
                        .append(file.chunks().size())
                        .append(", sizeBytes=")
                        .append(file.sizeBytes())
                        .append(")\n");
            }
            return summary.toString().trim();
        }

        List<SearchHit> hits = scoreHits(candidates, normalizedQuery);

        if (hits.isEmpty()) {
            return "Aucun passage pertinent trouve dans les fichiers de contexte.";
        }

        hits.sort(Comparator.comparingInt(SearchHit::score).reversed());
        int limit = Math.min(maxResultsPerSearch, hits.size());

        StringBuilder result = new StringBuilder("Extraits pertinents trouves:\n");
        for (int i = 0; i < limit; i++) {
            SearchHit hit = hits.get(i);
            result.append("[file=")
                    .append(hit.fileName())
                    .append(", chunk=")
                    .append(hit.chunkIndex())
                    .append(", score=")
                    .append(hit.score())
                    .append("]\n")
                    .append(hit.chunk())
                    .append("\n\n");
        }

        return result.toString().trim();
    }

    public List<String> findRelevantChunks(String sessionId, String query, String fileName, int limit) {
        LinkedHashMap<String, StoredContextFile> sessionFiles = store.get(sessionId);
        if (sessionFiles == null || sessionFiles.isEmpty() || limit <= 0) {
            return List.of();
        }

        String normalizedQuery = sanitize(query).toLowerCase(Locale.ROOT);
        String requestedFile = sanitize(fileName).toLowerCase(Locale.ROOT);

        List<StoredContextFile> candidates = sessionFiles.values().stream()
                .filter(file -> requestedFile.isBlank() || file.name().toLowerCase(Locale.ROOT).contains(requestedFile))
                .toList();

        if (candidates.isEmpty()) {
            return List.of();
        }

        if (normalizedQuery.isBlank()) {
            List<String> chunks = new ArrayList<>();
            for (StoredContextFile file : candidates) {
                for (String chunk : file.chunks()) {
                    if (chunk != null && !chunk.isBlank()) {
                        chunks.add(chunk);
                        if (chunks.size() >= limit) {
                            return chunks;
                        }
                    }
                }
            }
            return chunks;
        }

        List<SearchHit> hits = scoreHits(candidates, normalizedQuery);
        if (hits.isEmpty()) {
            return List.of();
        }

        int top = Math.min(limit, hits.size());
        List<String> chunks = new ArrayList<>(top);
        for (int i = 0; i < top; i++) {
            chunks.add(hits.get(i).chunk());
        }
        return chunks;
    }

    private List<SearchHit> scoreHits(List<StoredContextFile> candidates, String normalizedQuery) {
        List<String> terms = List.of(normalizedQuery.split("\\s+"));
        List<SearchHit> hits = new ArrayList<>();

        for (StoredContextFile file : candidates) {
            for (int i = 0; i < file.chunks().size(); i++) {
                String chunk = file.chunks().get(i);
                int score = scoreChunk(chunk, normalizedQuery, terms);
                if (score > 0) {
                    hits.add(new SearchHit(file.name(), i + 1, score, chunk));
                }
            }
        }

        hits.sort(Comparator.comparingInt(SearchHit::score).reversed());
        return hits;
    }

    private List<String> chunkContent(String content) {
        String normalized = content.replace("\r\n", "\n");
        List<String> chunks = new ArrayList<>();
        int start = 0;

        while (start < normalized.length()) {
            int end = Math.min(start + chunkSizeChars, normalized.length());
            if (end < normalized.length()) {
                int candidate = normalized.lastIndexOf('\n', end);
                if (candidate > start + (chunkSizeChars / 2)) {
                    end = candidate;
                }
            }

            String chunk = normalized.substring(start, end).trim();
            if (!chunk.isBlank()) {
                chunks.add(chunk);
            }
            start = Math.max(end + 1, start + 1);
        }

        return chunks;
    }

    private int scoreChunk(String chunk, String fullQuery, List<String> terms) {
        String lower = chunk.toLowerCase(Locale.ROOT);
        int score = 0;

        if (lower.contains(fullQuery)) {
            score += 10;
        }

        for (String term : terms) {
            if (term == null || term.isBlank() || term.length() < 2) {
                continue;
            }
            if (lower.contains(term)) {
                score += 2;
            }
        }

        return score;
    }

    private String sanitize(String value) {
        return value == null ? "" : value.trim();
    }

    private record StoredContextFile(
            String name,
            String contentType,
            long sizeBytes,
            Instant uploadedAt,
            List<String> chunks
    ) {
    }

    private record SearchHit(String fileName, int chunkIndex, int score, String chunk) {
    }
}
