import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const images = ['pao_left', 'pao_right', 'cheese'];
const inputDir = 'public/hero-cheese';

// Ensure input directory exists (sanity check, though we know it does)
if (!fs.existsSync(inputDir)) {
    console.error(`Error: Directory ${inputDir} not found.`);
    process.exit(1);
}

for (const name of images) {
    const inputPath = `${inputDir}/${name}.png`;
    const outputPath = `${inputDir}/${name}_500.png`;

    try {
        await sharp(inputPath)
            .resize(500, 500, {
                fit: 'contain', // Ensure aspect ratio is preserved and it fits within 500x500
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
            })
            .png({ quality: 85 })
            .toFile(outputPath);
        console.log(`✅ ${name}_500.png gerado`);
    } catch (error) {
        console.error(`❌ Erro ao processar ${name}:`, error);
    }
}
