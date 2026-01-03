#!/usr/bin/env node

/**
 * 版本号一致性检查脚本
 * 检查所有文件中的版本号是否与 manifest.json 一致
 */

const fs = require('fs');
const path = require('path');

// 读取manifest.json版本号（唯一真实来源）
const manifestPath = path.join(__dirname, '../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const expectedVersion = manifest.version;

console.log('\n🔍 版本号一致性检查');
console.log('===================\n');
console.log(`📌 基准版本（manifest.json）: ${expectedVersion}\n`);

let hasError = false;

// 检查package.json
const packagePath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const packageVersion = packageJson.version;

if (packageVersion === expectedVersion) {
  console.log(`✅ package.json: ${packageVersion}`);
} else {
  console.log(`❌ package.json: ${packageVersion} (期望: ${expectedVersion})`);
  hasError = true;
}

// 检查CLAUDE.md
const claudePath = path.join(__dirname, '../CLAUDE.md');
const claudeContent = fs.readFileSync(claudePath, 'utf8');
const claudeVersionMatch = claudeContent.match(/版本:\s*v(\d+\.\d+\.\d+)/);
const claudeVersion = claudeVersionMatch ? claudeVersionMatch[1] : null;

if (claudeVersion === expectedVersion) {
  console.log(`✅ CLAUDE.md: v${claudeVersion}`);
} else {
  console.log(`❌ CLAUDE.md: v${claudeVersion || '未找到'} (期望: v${expectedVersion})`);
  hasError = true;
}

// 检查README.md
const readmePath = path.join(__dirname, '../README.md');
const readmeContent = fs.readFileSync(readmePath, 'utf8');
const readmeVersionMatch = readmeContent.match(/###\s+v(\d+\.\d+\.\d+)\s+\(当前版本\)/);
const readmeVersion = readmeVersionMatch ? readmeVersionMatch[1] : null;

if (readmeVersion === expectedVersion) {
  console.log(`✅ README.md: v${readmeVersion}`);
} else {
  console.log(`❌ README.md: v${readmeVersion || '未找到'} (期望: v${expectedVersion})`);
  hasError = true;
}

// 检查README_EN.md
const readmeEnPath = path.join(__dirname, '../README_EN.md');
const readmeEnContent = fs.readFileSync(readmeEnPath, 'utf8');
const readmeEnVersionMatch = readmeEnContent.match(/###\s+v(\d+\.\d+\.\d+)\s+\(Current Version\)/);
const readmeEnVersion = readmeEnVersionMatch ? readmeEnVersionMatch[1] : null;

if (readmeEnVersion === expectedVersion) {
  console.log(`✅ README_EN.md: v${readmeEnVersion}`);
} else {
  console.log(`❌ README_EN.md: v${readmeEnVersion || '未找到'} (期望: v${expectedVersion})`);
  hasError = true;
}

console.log('\n' + '='.repeat(50));

if (hasError) {
  console.log('\n❌ 发现版本号不一致！请运行 npm run sync-version 同步\n');
  process.exit(1);
} else {
  console.log('\n✅ 所有版本号一致！\n');
  process.exit(0);
}
