import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Function to recursively list all directories and files
function listAllFiles(dir, outputFile, indent = '') {
  try {
    fs.appendFileSync(outputFile, `${indent}📁 ${dir}\n`);
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        if (item !== 'node_modules') {
          listAllFiles(itemPath, outputFile, indent + '  ');
        } else {
          fs.appendFileSync(outputFile, `${indent}  📁 ${item} (node_modules - skipped)\n`);
        }
      } else {
        fs.appendFileSync(outputFile, `${indent}  📄 ${item}\n`);
      }
    }
  } catch (error) {
    fs.appendFileSync(outputFile, `${indent}❌ Error reading ${dir}: ${error.message}\n`);
  }
}

// Main function
function main() {
  const outputFile = 'build-debug.txt';
  
  // Clear previous debug file
  fs.writeFileSync(outputFile, '');
  
  // Log current working directory
  fs.appendFileSync(outputFile, `Current working directory: ${process.cwd()}\n\n`);
  
  // Log environment variables
  fs.appendFileSync(outputFile, 'Environment Variables:\n');
  Object.keys(process.env).sort().forEach(key => {
    fs.appendFileSync(outputFile, `${key}=${process.env[key]}\n`);
  });
  fs.appendFileSync(outputFile, '\n');
  
  // List all directories and files
  fs.appendFileSync(outputFile, 'Directory Structure:\n');
  listAllFiles('.', outputFile);
  
  // Run vocs build with verbose logging
  try {
    fs.appendFileSync(outputFile, '\nRunning vocs build with --debug flag:\n');
    const buildOutput = execSync('cd docs && npx vocs build --debug').toString();
    fs.appendFileSync(outputFile, buildOutput);
  } catch (error) {
    fs.appendFileSync(outputFile, `Error running vocs build: ${error.message}\n`);
    if (error.stdout) fs.appendFileSync(outputFile, `stdout: ${error.stdout}\n`);
    if (error.stderr) fs.appendFileSync(outputFile, `stderr: ${error.stderr}\n`);
  }
  
  // List directories again after build
  fs.appendFileSync(outputFile, '\nDirectory Structure After Build:\n');
  listAllFiles('.', outputFile);
  
  console.log(`Debug information written to ${outputFile}`);
}

main(); 