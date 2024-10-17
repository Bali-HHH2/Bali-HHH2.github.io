import { readFile, writeFile, readdir, stat, unlink } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { parse } from 'node-html-parser';

function shouldRemoveSrcsetItem(src) {
  // Check if the src contains dimensions (e.g., 36x36)
  return /\d+x\d+/.test(src);
}

async function processHtmlFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const root = parse(content);

    const imgElements = root.querySelectorAll('img[srcset]');
    const filesToDelete = [];
    let modified = false;

    imgElements.forEach((img) => {
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        const srcsetItems = srcset.split(',').map(s => s.trim());
        const [firstItem, ...restItems] = srcsetItems;

        // Keep the first item
        const newSrcset = [firstItem];

        // Filter out items with dimensions and collect files to delete
        restItems.forEach(item => {
          const [src] = item.split(' ');
          if (shouldRemoveSrcsetItem(src)) {
            filesToDelete.push(src);
          } else {
            newSrcset.push(item);
          }
        });

        // Set the new srcset attribute
        img.setAttribute('srcset', newSrcset.join(', '));
        modified = true;
      }
    });

    if (modified) {
      await writeFile(filePath, root.toString(), 'utf-8');
      console.log(`Modified: ${filePath}`);

      // Delete files referenced in removed srcset items
      for (const file of filesToDelete) {
        const fullPath = join('archive/', file);
        try {
          await unlink(fullPath);
          console.log(`Deleted: ${fullPath}`);
        } catch (error) {
          console.error(`Failed to delete: ${fullPath}`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

async function processDirectory(directory) {
  try {
    const entries = await readdir(directory);

    for (const entry of entries) {
      const fullPath = join(directory, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        await processDirectory(fullPath);
      } else if (stats.isFile() && extname(entry).toLowerCase() === '.html') {
        await processHtmlFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${directory}:`, error);
  }
}

// Main execution
const targetDirectory = process.argv[2];

if (!targetDirectory) {
  console.error('Please provide a target directory as an argument.');
  process.exit(1);
}

console.log(`Processing directory: ${targetDirectory}`);
processDirectory(targetDirectory)
  .then(() => console.log('Processing complete.'))
  .catch((error) => console.error('An error occurred:', error));
