import fs from 'fs';
import path from 'path';

const sourcesDir = path.join(process.cwd(), 'sources');
const outputFile = path.join(process.cwd(), 'src', 'embeddedSources.ts');

function generate() {
  if (!fs.existsSync(sourcesDir)) {
    console.log('Sources directory not found, creating empty embedded sources.');
    fs.writeFileSync(outputFile, 'export const EMBEDDED_SOURCES: Record<string, string> = {};\n');
    return;
  }

  const files = fs.readdirSync(sourcesDir).filter(f => f.endsWith('.txt'));
  const sources = {};

  files.forEach(file => {
    const content = fs.readFileSync(path.join(sourcesDir, file), 'utf-8');
    sources[file] = content;
  });

  const content = `export const EMBEDDED_SOURCES: Record<string, string> = ${JSON.stringify(sources, null, 2)};\n`;
  
  // Ensure src directory exists
  const srcDir = path.dirname(outputFile);
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, content);
  console.log(`Generated ${outputFile} with ${files.length} sources.`);
}

generate();
