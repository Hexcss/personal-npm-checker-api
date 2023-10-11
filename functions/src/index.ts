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

    let packages: { [key: string]: string } = {};
    if (data.dependencies) {
        packages = { ...packages, ...data.dependencies };
    }
    if (data.devDependencies) {
        packages = { ...packages, ...data.devDependencies };
    }

    if (Object.keys(packages).length === 0) {
        res.status(400).send("No dependencies or devDependencies found in the provided data");
        return;
    }

    let deprecatedCount = 0;
    let outdatedCount = 0;
    const totalPackages = Object.keys(packages).length;
    const deprecatedPackages: { [key: string]: string } = {};
    const outdatedPackages: { [key: string]: string } = {};

    for (const [pkg, version] of Object.entries(packages)) {
        const commandDeprecated = `npm info ${pkg} deprecated`;
        const commandLatest = `npm info ${pkg} version`;
        try {
            const deprecatedResult = execSync(commandDeprecated, { encoding: 'utf8' }).trim();
            if (deprecatedResult) {
                deprecatedPackages[pkg] = deprecatedResult;
                deprecatedCount++;
            }

            const latestVersion = execSync(commandLatest, { encoding: 'utf8' }).trim();
            if (latestVersion !== version) {
                outdatedPackages[pkg] = latestVersion;
                outdatedCount++;
            }

            // Log the progress
            const progress = (((deprecatedCount + outdatedCount) / totalPackages) * 100).toFixed(2);
            console.log(`Checking: ${pkg}... (${progress}% completed)`);
            
        } catch (error) {
            // Error occurs when npm cannot find info for a package
            console.error(`Failed to check ${pkg}. Error:`, (error as Error).message);
            continue;
        }
    }

    console.log(`Finished checking. Found ${deprecatedCount} deprecated and ${outdatedCount} outdated packages out of ${totalPackages} checked.`);

    const response = {
        total_checked: totalPackages,
        total_deprecated: deprecatedCount,
        total_outdated: outdatedCount,
        deprecated_packages: deprecatedPackages,
        outdated_packages: outdatedPackages
    };

    res.status(200).json(response);
});

app.get('/healthCheck', (req, res) => {
    res.status(200).json({ status: "Server is running" });
});

export const api = functions.runWith({ timeoutSeconds: 300 }).https.onRequest(app);
