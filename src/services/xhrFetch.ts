export const xhrFetch = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Handle URL
        let urlString = '';
        if (typeof url === 'string') {
            urlString = url;
        } else if (url instanceof URL) {
            urlString = url.toString();
        } else if (url && 'url' in url) {
            urlString = url.url;
        }
        
        xhr.open(init?.method || 'GET', urlString, true);
        
        // Handle headers
        if (init?.headers) {
            const headers = new Headers(init.headers);
            headers.forEach((value, key) => {
                xhr.setRequestHeader(key, value);
            });
        }
        
        // Handle response type
        xhr.responseType = 'blob';
        
        xhr.onload = () => {
            const options = {
                status: xhr.status,
                statusText: xhr.statusText,
                headers: new Headers()
            };
            
            const headersString = xhr.getAllResponseHeaders();
            if (headersString) {
                headersString.trim().split(/[\r\n]+/).forEach((line) => {
                    const parts = line.split(': ');
                    const header = parts.shift();
                    const value = parts.join(': ');
                    if (header) {
                        options.headers.append(header, value);
                    }
                });
            }
            
            resolve(new Response(xhr.response, options));
        };
        
        xhr.onerror = () => reject(new TypeError('Network request failed'));
        xhr.ontimeout = () => reject(new TypeError('Network request failed'));
        
        if (init?.signal) {
            if (init.signal.aborted) {
                reject(new DOMException('Aborted', 'AbortError'));
                return;
            }
            init.signal.addEventListener('abort', () => {
                xhr.abort();
                reject(new DOMException('Aborted', 'AbortError'));
            });
        }
        
        // Handle body
        if (init?.body) {
            xhr.send(init.body as any);
        } else {
            xhr.send();
        }
    });
};
