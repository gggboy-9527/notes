#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 仓库根目录（脚本所在目录）
const rootDir = __dirname;

/**
 * 递归读取所有 .md 文件（排除 .git）
 */
function collectMdFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

    if (item.isDirectory()) {
      // 跳过 .git 目录
      if (item.name === '.git') continue;
      collectMdFiles(fullPath, fileList);
    } else if (item.isFile() && item.name.endsWith('.md')) {
      fileList.push({ path: relativePath });
    }
  }

  return fileList;
}

// 收集所有 .md 文件
const files = collectMdFiles(rootDir);

// 按路径排序（可选，但推荐，便于 diff）
files.sort((a, b) => a.path.localeCompare(b.path));

// 构建最终数据
const indexData = { files };

// 写入 index.json，格式化 + 换行
fs.writeFileSync(
  path.join(rootDir, 'index.json'),
  JSON.stringify(indexData, null, 2) + '\n',
  'utf8'
);

console.log(`✅ 找到 ${files.length} 个 .md 文件`);
console.log('✅ index.json 已更新');