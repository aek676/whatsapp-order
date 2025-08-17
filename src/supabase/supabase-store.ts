import supabase from './client.js';
import { type Store } from 'whatsapp-web.js';
import * as fs from 'fs';

export class SupabaseStore implements Store {
    private extractUUID(sessionString: string): string {
        // Quitar el prefijo "RemoteAuth-" si existe
        return sessionString.replace(/^RemoteAuth-/, '');
    }

    async sessionExists(options: { session: string }): Promise<boolean> {
        try {
            const establishmentId = this.extractUUID(options.session);
            console.log('Checking if session exists for establishment:', establishmentId);

            const { data, error } = await supabase
                .from('whatsapp_auth')
                .select('id_whatsapp_auth')
                .eq('id_establishment', establishmentId)
                .single();

            return !error && !!data;
        } catch (error) {
            console.error('Error checking session existence:', error);
            return false;
        }
    }

    async save(options: { session: string }): Promise<unknown> {
        try {
            const establishmentId = this.extractUUID(options.session);
            console.log('Save called for establishment:', establishmentId);

            // El archivo ZIP que genera RemoteAuth
            const zipPath = `${options.session}.zip`;

            if (!fs.existsSync(zipPath)) {
                console.log('No ZIP file found to save');
                return false;
            }

            // Obtener información del archivo
            const stats = fs.statSync(zipPath);
            console.log(`ZIP file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

            // Leer el archivo inmediatamente antes de programar la operación async
            const fileBuffer = fs.readFileSync(zipPath);
            console.log('File read into memory, scheduling async save...');

            // Guardar usando Supabase Storage para archivos grandes
            setImmediate(async () => {
                try {
                    console.log('Starting async save to Supabase Storage...');

                    // Nombre único para el archivo en storage
                    const fileName = `whatsapp-sessions/${establishmentId}/session.zip`;

                    // Subir archivo a Supabase Storage
                    const { error: uploadError } = await supabase.storage
                        .from('whatsapp-sessions')
                        .upload(fileName, fileBuffer, {
                            cacheControl: '3600',
                            upsert: true,
                            contentType: 'application/zip'
                        });

                    if (uploadError) {
                        console.error('Error uploading to Supabase Storage:', uploadError);
                        return;
                    }

                    console.log('File uploaded to Storage successfully');

                    // Guardar metadatos en la tabla
                    const { error: dbError } = await supabase
                        .from('whatsapp_auth')
                        .upsert({
                            id_establishment: establishmentId,
                            session_data: {
                                storageKey: fileName,
                                timestamp: new Date().toISOString(),
                                originalSize: stats.size
                            },
                            file_size: stats.size,
                            file_type: 'application/zip'
                        }, {
                            onConflict: 'id_establishment'
                        });

                    if (dbError) {
                        console.error('Error saving metadata to Supabase:', dbError);
                        // Intentar limpiar el archivo subido si falló la metadata
                        await supabase.storage
                            .from('whatsapp-sessions')
                            .remove([fileName]);
                    } else {
                        console.log('Session saved successfully to Supabase');
                        // Solo eliminar el archivo local si se guardó exitosamente
                        try {
                            if (fs.existsSync(zipPath)) {
                                fs.unlinkSync(zipPath);
                                console.log('Local ZIP file deleted after successful save');
                            }
                        } catch (unlinkError) {
                            console.warn('Could not delete local ZIP file:', unlinkError);
                        }
                    }
                } catch (asyncError) {
                    console.error('Error in async save process:', asyncError);
                }
            });

            // Retornar inmediatamente sin esperar la operación de base de datos
            console.log('Save operation scheduled, returning immediately');
            return true;
        } catch (error) {
            console.error('Error in save:', error);
            return false;
        }
    }

    async extract(options: { session: string, path: string }): Promise<unknown> {
        try {
            const establishmentId = this.extractUUID(options.session);
            console.log('Extracting session data for establishment:', establishmentId, 'to path:', options.path);

            const { data, error } = await supabase
                .from('whatsapp_auth')
                .select('session_data')
                .eq('id_establishment', establishmentId)
                .single();

            if (error || !data) {
                console.log('No session data found');
                return null;
            }

            // Extraer datos de la sesión
            const sessionData = data.session_data as { storageKey?: string; zipData?: string; timestamp: string };

            // Manejar tanto el formato nuevo (Storage) como el antiguo (base64)
            if (sessionData.storageKey) {
                // Nuevo formato: descargar desde Supabase Storage
                console.log('Downloading from Supabase Storage:', sessionData.storageKey);

                const { data: fileData, error: downloadError } = await supabase.storage
                    .from('whatsapp-sessions')
                    .download(sessionData.storageKey);

                if (downloadError || !fileData) {
                    console.error('Error downloading from Storage:', downloadError);
                    return null;
                }

                // Convertir Blob a Buffer y escribir archivo
                const arrayBuffer = await fileData.arrayBuffer();
                const fileBuffer = Buffer.from(arrayBuffer);
                fs.writeFileSync(options.path, fileBuffer);

            } else if (sessionData.zipData) {
                // Formato antiguo: datos en base64
                console.log('Using legacy base64 data');
                const fileBuffer = Buffer.from(sessionData.zipData, 'base64');
                fs.writeFileSync(options.path, fileBuffer);

            } else {
                console.log('No session data found');
                return null;
            }

            console.log('Session extracted successfully to:', options.path);
            return true;
        } catch (error) {
            console.error('Error extracting session:', error);
            return null;
        }
    }

    async delete(options: { session: string }): Promise<unknown> {
        try {
            const establishmentId = this.extractUUID(options.session);
            console.log('Deleting session for establishment:', establishmentId);

            // Eliminar archivo local si existe
            const zipPath = `${options.session}.zip`;
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
                console.log('Local ZIP file deleted');
            }

            // Obtener datos antes de eliminar para limpiar Storage si es necesario
            const { data } = await supabase
                .from('whatsapp_auth')
                .select('session_data')
                .eq('id_establishment', establishmentId)
                .single();

            // Eliminar de Supabase Storage si existe
            if (data?.session_data) {
                const sessionData = data.session_data as { storageKey?: string };
                if (sessionData.storageKey) {
                    console.log('Deleting from Supabase Storage:', sessionData.storageKey);
                    const { error: storageError } = await supabase.storage
                        .from('whatsapp-sessions')
                        .remove([sessionData.storageKey]);

                    if (storageError) {
                        console.warn('Error deleting from Storage:', storageError);
                    } else {
                        console.log('File deleted successfully from Storage');
                    }
                }
            }

            // Eliminar registro de la base de datos
            const { error } = await supabase
                .from('whatsapp_auth')
                .delete()
                .eq('id_establishment', establishmentId);

            if (error) {
                console.error('Error deleting session from Supabase:', error);
                throw error;
            }

            console.log('Session deleted successfully from Supabase');
            return true;
        } catch (error) {
            console.error('Error deleting session:', error);
            throw error;
        }
    }
}