import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'linkify',
  standalone: true
})
export class LinkifyPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(text: string): SafeHtml {
    if (!text) {
      return '';
    }

    // Regex to match URLs (http, https, ftp, and relative paths)
    const urlRegex = /(https?:\/\/[^\s]+|http:\/\/[^\s]+|ftp:\/\/[^\s]+|\/[^\s]*(?![^\s]*['">]))/g;

    // Replace URLs with anchor tags
    let htmlText = text.replace(urlRegex, (url) => {
      // Trim common punctuation from end of URL if present
      let cleanUrl = url.trim();
      let trailing = '';
      
      while (cleanUrl && /[.,;:!?\)]$/.test(cleanUrl)) {
        trailing = cleanUrl[cleanUrl.length - 1] + trailing;
        cleanUrl = cleanUrl.slice(0, -1);
      }

      // Make relative paths absolute
      const href = cleanUrl.startsWith('/') ? `http://localhost:8081${cleanUrl}` : cleanUrl;
      const displayUrl = cleanUrl.length > 50 ? cleanUrl.substring(0, 50) + '...' : cleanUrl;

      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="chat-link">${displayUrl}</a>${trailing}`;
    });

    // Escape other HTML to prevent injection
    htmlText = this.escapeHtml(htmlText);

    // Now unescape the anchor tags we just created
    htmlText = htmlText.replace(/&lt;a href=&quot;(.+?)&quot; target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot; class=&quot;chat-link&quot;&gt;(.+?)&lt;\/a&gt;/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$2</a>');

    return this.sanitizer.bypassSecurityTrustHtml(htmlText);
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
