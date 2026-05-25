import { mkdir, readdir, copyFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function install() {
  console.log('Installing AOSP Analysis Skills...');
  
  try {
    // 目标目录是用户home目录下的 .config/opencode/skills/
    const targetSkillsDir = join(homedir(), '.config', 'opencode', 'skills');
    const sourceSkillsDir = join(__dirname, 'skills');
    
    // 检查源目录是否存在
    if (!existsSync(sourceSkillsDir)) {
      console.log('Source skills directory not found, skipping installation...');
      return;
    }
    
    // 复制所有 skills
    await copyDir(sourceSkillsDir, targetSkillsDir);
    
    console.log('✓ AOSP Analysis Skills installed successfully!');
    console.log(`✓ Skills location: ${targetSkillsDir}`);
    
    // 列出安装的 skills
    const { glob } = await import('glob');
    const skillFiles = await glob('**/SKILL.md', { cwd: sourceSkillsDir });
    console.log(`✓ Installed ${skillFiles.length} skills:`);
    skillFiles.forEach(file => console.log(`  - ${file.replace('/SKILL.md', '')}`));
    
    console.log('\nYou can now use these skills in OpenCode!');
    
  } catch (error) {
    console.error('Installation failed:', error);
    process.exit(1);
  }
}

install();