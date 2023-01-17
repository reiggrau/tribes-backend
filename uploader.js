import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import multer from "multer"; // npm install multer
import uidSafe from "uid-safe"; // npm install uid-safe

const storage = multer.diskStorage({
    destination: path.join(__dirname, "uploads"),
    filename: (req, file, callback) => {
        uidSafe(24).then((uid) => {
            const randomFileName = uid + path.extname(file.originalname); // randomimagename.png
            callback(null, randomFileName);
        });
    },
});

const uploader = multer({
    storage,
    limits: {
        fileSize: 3097152,
    },
});

export default uploader;
