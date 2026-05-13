package com.healthapp.chatbot.controller;

import com.healthapp.chatbot.model.document.DocumentSummaryResponse;
import com.healthapp.chatbot.service.DocumentSummaryService;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.http.codec.multipart.FormFieldPart;
import org.springframework.http.codec.multipart.Part;
import org.springframework.stereotype.Controller;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

@Controller
@RequestMapping("/api/v1/document-summaries")
public class DocumentSummaryController {

    private static final Logger logger = LoggerFactory.getLogger(DocumentSummaryController.class);

    private final DocumentSummaryService documentSummaryService;

    public DocumentSummaryController(DocumentSummaryService documentSummaryService) {
        this.documentSummaryService = documentSummaryService;
    }

    @PostMapping(path = "/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Mono<DocumentSummaryResponse> generate(
            @RequestBody Mono<MultiValueMap<String, Part>> partsMono
    ) {
        return partsMono.flatMap(parts -> {
            logger.info("[DocumentSummaryController] generate called. partNames={}", parts.keySet());

            String partDetails = parts.entrySet().stream()
                    .map(entry -> {
                        Part first = entry.getValue() == null || entry.getValue().isEmpty() ? null : entry.getValue().get(0);
                        if (first == null) {
                            return entry.getKey() + "=<empty>";
                        }
                        MediaType partContentType = first.headers().getContentType();
                        String contentType = partContentType == null
                                ? "null"
                                : partContentType.toString();
                        return entry.getKey() + "=" + first.getClass().getSimpleName() + "(contentType=" + contentType + ")";
                    })
                    .collect(Collectors.joining(", "));
            logger.info("[DocumentSummaryController] part details: {}", partDetails);

            Part metadataPart = parts.getFirst("metadata");
            Part documentPart = parts.getFirst("document");

            if (metadataPart == null) {
                logger.error("[DocumentSummaryController] Missing multipart part: metadata");
                return Mono.error(new ResponseStatusException(HttpStatusCode.valueOf(400), "metadata is required"));
            }
            if (!(documentPart instanceof FilePart filePart)) {
                logger.error("[DocumentSummaryController] Missing or invalid multipart part: document. partClass={}", documentPart == null ? "null" : documentPart.getClass().getName());
                return Mono.error(new ResponseStatusException(HttpStatusCode.valueOf(400), "document file is required"));
            }

            logger.info("[DocumentSummaryController] document filename={} contentType={}",
                    filePart.filename(),
                    filePart.headers().getContentType());

            return partToString(metadataPart)
                    .doOnNext(metadataJson -> logger.info("[DocumentSummaryController] metadata chars={} FULL BEGIN\n{}\n[DocumentSummaryController] metadata FULL END",
                        metadataJson.length(),
                        metadataJson))
                    .map(documentSummaryService::parseMetadata)
                    .flatMap(metadata -> documentSummaryService.generateSummary(metadata, filePart))
                    .doOnSuccess(response -> logger.info("[DocumentSummaryController] Summary generated successfully. title={} descriptionChars={}",
                            response.title(),
                            response.description() == null ? 0 : response.description().length()))
                    .doOnError(error -> logger.error("[DocumentSummaryController] Summary generation failed", error));
        });
    }

    private Mono<String> partToString(Part part) {
        if (part instanceof FormFieldPart formFieldPart) {
            return Mono.just(formFieldPart.value());
        }

        return DataBufferUtils.join(part.content())
                .map(dataBuffer -> {
                    byte[] bytes = new byte[dataBuffer.readableByteCount()];
                    dataBuffer.read(bytes);
                    DataBufferUtils.release(dataBuffer);
                    return new String(bytes, StandardCharsets.UTF_8);
                });
    }
}
