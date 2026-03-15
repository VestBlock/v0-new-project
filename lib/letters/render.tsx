// lib/letters/render.ts
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  // Import heavy deps lazily to avoid route handler evaluation crashes.
  const React = await import('react'); // required by @react-pdf/renderer
  const renderer = await import('@react-pdf/renderer');

  const { Document, Page, Text, View, StyleSheet } = renderer;
  const styles = StyleSheet.create({
    page: { padding: 36, fontSize: 12, fontFamily: 'Times-Roman' },
  });

  const Doc = () =>
    React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'LETTER', style: styles.page },
        React.createElement(
          View,
          null,
          React.createElement(Text, null, html.replace(/<[^>]+>/g, ''))
        )
      )
    );

  const { renderToBuffer } = renderer;
  const buffer = await renderToBuffer(React.createElement(Doc));
  return Buffer.from(buffer);
}
