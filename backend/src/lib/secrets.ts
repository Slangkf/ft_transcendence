import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";


export class SecretsManager {
    private static secretsCach: Map<string, string> = new Map();

    /***
     * get les valeurs of secrets 
     * @param variableName( name of variable in majuscule)
     * @param defaultValue
     * @returns secret value
     * 
     */
    static getSecret(variableName: string, defaultValue?: string): string{
        if (this.secretsCach.has(variableName)){
            return this.secretsCach.get(variableName)!;
        }

        let secretValue: string | undefined;

        //1. get from docker secret 
        secretValue = this.readFromDockerSecret(variableName);
        if (secretValue){
            this.secretsCach.set(variableName, secretValue);
            console.log(`Loaded ${variableName} from Docker secret file`);
            return secretValue;
        }

        //2. get from env 
        secretValue = process.env[variableName];
        if (secretValue){
            this.secretsCach.set(variableName, secretValue);
            console.log(`Loaded value for ${variableName} from env`);
            return secretValue
        }
        //default
        if (defaultValue){
            this.secretsCach.set(variableName, defaultValue)
            console.log(`Using default value for ${variableName}`)
            return defaultValue;
        }
        throw new Error(`${variableName} not found`);
    }

    /**
     * readFromDockerSecret(change filename to Uppercase=> variable)
     * @param variableName 
     * @returns secret value
     */
    private static readFromDockerSecret(variableName: string): string | undefined{
        const secretsDir = '/run/secrets';
        if (!existsSync(secretsDir)){
            return undefined
        }

        try{
            //upload all files
            const files = readdirSync(secretsDir);
            
            //
            const lowerName = variableName.toLowerCase();

            for (const file of files) {
                if (file.toLowerCase() === lowerName) {
                    const secretFilePath = path.join(secretsDir, file);
                    const secretValue = readFileSync(secretFilePath, 'utf-8').trim();
                    console.log(`   📂 /run/secrets/${file}`);
                    return secretValue;
                }
            }
        } catch(error){
            console.error(`Error reading docker secret ${error}`)
        }
        return undefined;
    }

    /**
     * load all secrets
     * 
     */
    static loadAllSecrets(): void{
        const requiredSecrets= [
            'JWT_SECRET',
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GOOGLE_CALLBACK_URL',
            'GITHUB_CLIENT_ID',
            'GITHUB_CLIENT_SECRET',
            'GITHUB_CALLBACK_URL',
            'DATABASE_URL',
            'REDIS_URL',
        ];
        const options = [
            'POSTGRES_USER',
            'POSTGRES_PASSWORD',
            'POSTGRES_DB',
            'ADMIN_EMAIL',
            'ADMIN_PASSWORD',
        ]
        for(const secret of requiredSecrets) {
            try{
                process.env[secret] = this.getSecret(secret);
            }catch(error){
                console.error(`Failed to load ${secret}: ${error}`);
                throw error;
            }
        }
        for (const secret of options) {
            try {
                process.env[secret] = this.getSecret(secret, 'development');
            } catch (error) {
                console.warn(`  optional: ${secret} not found`);
            }
        }
        console.log("\n All secrets loaded successfully!\n");
    }

    static verifySecrets(): void{
        const required = [
            'JWT_SECRET',
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GOOGLE_CALLBACK_URL',
            'GITHUB_CLIENT_ID',
            'GITHUB_CLIENT_SECRET',
            'GITHUB_CALLBACK_URL',
            'DATABASE_URL',
            'REDIS_URL',
        ];
        const missing = required.filter(secret => !process.env[secret]);
        if (missing.length > 0){
            console.error(`missing secrets: ${missing.join(', ')}`)
            throw new Error ('Missing required secrets')
        }
        console.log("All required secrets verified!");
    }
}