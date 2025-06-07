'use client';

import { MathJax, MathJaxContext } from 'better-react-mathjax';

export default function MathOutput({ content }: { content: string }) {
  return (
    <MathJaxContext version={3}>
      <MathJax>{content}</MathJax>
    </MathJaxContext>
  );
}
