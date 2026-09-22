export class RadControls {
  public RadButton(
    url: string,
    title: string,
    css: string,
    newWindow = false,
  ): string {
    const targetAttributes = newWindow
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";

    return `<a href="${this.escapeHtml(url)}" class="btn ${this.escapeHtml(css)} d-block w-100"${targetAttributes}>${this.escapeHtml(title)}</a>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return entities[character];
    });
  }
}
