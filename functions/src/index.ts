import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import { execSync } from 'child_process';

admin.initializeApp();

const app = express();

app.use(express.json());
app.use(cors());

app.post('/checkDeprecated', (req, res) => {
    const data = req.body;

    if (!data) {
        res.status(400).send("Invalid request format. Please send a valid JSON object.");
        return;
    }

    let packages: string[] = [];
    if (data.dependencies) {
        packages = Object.keys(data.dependencies);
    } else if (data.devDependencies) {
        packages = Object.keys(data.devDependencies);
    } else {
        res.status(400).send("No dependencies or devDependencies found in the provided data");
        return;
    }

    let deprecatedCount = 0;
    let packagesChecked = 0;
    const totalPackages = packages.length;
    const deprecatedPackages: { [key: string]: string } = {};

    for (const pkg of packages) {
        const command = `npm info ${pkg} deprecated`;
        try {
            const result = execSync(command, { encoding: 'utf8' }).trim();
            if (result) {
                deprecatedPackages[pkg] = result;
                deprecatedCount++;
            }
            packagesChecked++;

            // Log the progress
            const progress = ((packagesChecked / totalPackages) * 100).toFixed(2);
            console.log(`Checking: ${pkg}... (${progress}% completed)`);
            
            // Thread-like animation (using ASCII characters to simulate a rotating spinner)
            const spinner = ['|', '/', '-', '\\'];
            console.log(`Working... ${spinner[packagesChecked % 4]}`);
            
        } catch (error) {
            // Error occurs when npm cannot find info for a package
            console.error(`Failed to check ${pkg}. Error:`, (error as Error).message);
            continue;
        }
    }

    console.log(`Finished checking. Found ${deprecatedCount} deprecated packages out of ${totalPackages} checked.`);

    const response = {
        total_checked: packagesChecked,
        total_deprecated: deprecatedCount,
        deprecated_packages: deprecatedPackages
    };

    res.status(200).json(response);
});

app.get('/healthCheck', (req, res) => {
    res.status(200).json({ status: "Server is running" });
});

export const api = functions.runWith({ timeoutSeconds: 300 }).https.onRequest(app);
