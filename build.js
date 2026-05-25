import { readFile, writeFile, mkdir, readdir, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const skillsSource = join(__dirname, 'skills');
const skillsTarget = join(__dirname, '_site', 'skills');
const wellKnownTarget = join(__dirname, '_site', '.well-known', 'skills');

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function build() {
  console.log('Building AOSP Analysis Skills...');
  
  try {
    // 创建目标目录
    await mkdir(skillsTarget, { recursive: true });
    
    // 复制所有 skills 到 _site/skills/
    await copyDir(skillsSource, skillsTarget);
    
    // 创建 .well-known/skills/ 目录
    await mkdir(wellKnownTarget, { recursive: true });
    
    // 复制所有 skills 到 .well-known/skills/ (用于 GitHub Pages 端点)
    await copyDir(skillsSource, wellKnownTarget);
    
    console.log('Build completed successfully!');
    console.log(`Skills copied to: ${skillsTarget}`);
    console.log(`Well-known endpoint: ${wellKnownTarget}`);
    
    // 列出所有有效的 skills
    const { glob } = await import('glob');
    const skillFiles = await glob('**/SKILL.md', { cwd: skillsSource });
    console.log(`\nFound ${skillFiles.length} skills:`);
    skillFiles.forEach(file => console.log(`  - ${file}`));
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();