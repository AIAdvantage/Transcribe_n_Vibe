/**
 * Utility functions for the Comeback Generator application
 */

// DOM Element Utilities
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Audio Processing Utilities
class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.visualizerBars = [];
        this.visualizerInitialized = false;
    }

    async initAudioContext(sampleRate = 16000) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: sampleRate // Match the sample rate expected by speech recognition APIs
            });
            
            return this.audioContext;
        } catch (error) {
            console.error('Failed to initialize audio context with sample rate:', sampleRate, error);
            // Try again with default sample rate if specific one fails
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    latencyHint: 'interactive'
                });
                console.log('Using default sample rate:', this.audioContext.sampleRate);
                return this.audioContext;
            } catch (fallbackError) {
                throw new Error('Failed to initialize audio context: ' + fallbackError.message);
            }
        }
    }
    
    // Convert audio buffer to WAV format
    convertToWav(audioBuffer) {
        const numOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numOfChannels * 2;
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        
        /* RIFF identifier */
        this.writeString(view, 0, 'RIFF');
        /* file length */
        view.setUint32(4, 36 + length, true);
        /* RIFF type */
        this.writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        this.writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, numOfChannels, true);
        /* sample rate */
        view.setUint32(24, audioBuffer.sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, audioBuffer.sampleRate * 2 * numOfChannels, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, numOfChannels * 2, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        this.writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, length, true);
        
        /* write the PCM samples */
        const data = new Float32Array(audioBuffer.getChannelData(0));
        let offset = 44;
        for (let i = 0; i < data.length; i++) {
            const sample = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }
    
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    setupVisualizer(stream, containerElement) {
        if (!this.audioContext) {
            throw new Error('Audio context is not initialized');
        }

        // Clear existing bars regardless of initialization state
        containerElement.innerHTML = '';
        this.visualizerBars = [];
        
        // Create a more visible container that works with both light and dark modes
        containerElement.style.backgroundColor = 'rgba(128, 128, 128, 0.15)';
        containerElement.style.borderRadius = '4px';
        containerElement.style.padding = '5px';
        containerElement.style.minWidth = '120px';
        
        // Create new bars (fewer bars for better visibility)
        for (let i = 0; i < 12; i++) {
            const bar = document.createElement('div');
            
            // Skip CSS classes and set all styles directly
            Object.assign(bar.style, {
                display: 'inline-block',
                width: '5px',
                height: '5px',
                margin: '0 2px',
                backgroundColor: '#0EA27F',
                transition: 'height 0.1s ease-out'
            });
            
            containerElement.appendChild(bar);
            this.visualizerBars.push(bar);
        }
        
        console.log('Visualizer bars created:', this.visualizerBars.length);
        this.visualizerInitialized = true;

        // Set up audio analyzer
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        
        source.connect(this.analyser);
        
        // Start visualization
        this.updateVisualizer();
    }

    updateVisualizer() {
        if (!this.analyser || !this.visualizerBars.length) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate an average level for visualization simplicity
        let sum = 0;
        const barCount = this.visualizerBars.length;
        
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        
        const average = sum / this.dataArray.length;
        console.log('Audio level:', average); // Debug audio level
        
        // Update each bar with some randomization for a more natural look
        for (let i = 0; i < barCount; i++) {
            const bar = this.visualizerBars[i];
            const randomFactor = 0.8 + Math.random() * 0.4; // Random value between 0.8 and 1.2
            // Make the bars much more visible with a higher multiplier
            const height = Math.max(5, Math.min(40, average * randomFactor * 0.8));
            
            // Directly set all CSS properties to ensure visibility
            Object.assign(bar.style, {
                height: height + 'px',
                backgroundColor: '#0EA27F', // Hardcoded color instead of CSS variable
                display: 'inline-block',
                width: '3px',
                margin: '0 1px',
                transition: 'height 0.1s ease-out'
            });
        }
        
        // Continue updating while analyzer exists
        if (this.analyser) {
            requestAnimationFrame(() => this.updateVisualizer());
        }
    }

    stopVisualizer() {
        this.analyser = null;
        this.dataArray = null;
        
        // Reset visualizer bars
        for (const bar of this.visualizerBars) {
            Object.assign(bar.style, {
                height: '5px',
                backgroundColor: 'rgba(14, 162, 127, 0.3)', // Dimmer when inactive
                display: 'inline-block', // Ensure they're still visible
                width: '5px',
                margin: '0 2px',
                transition: 'height 0.1s ease-out'
            });
        }
        
        console.log('Visualizer stopped');
    }

    // Check if audio buffer contains actual speech (not just silence)
    hasSpeech(audioBuffer, threshold = 0.01) {
        // Get audio data from the first channel
        const audioData = audioBuffer.getChannelData(0);
        
        // Calculate RMS (Root Mean Square) value to detect energy level
        let sumSquares = 0;
        for (let i = 0; i < audioData.length; i++) {
            sumSquares += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sumSquares / audioData.length);
        
        console.log('🔊 Audio RMS energy level:', rms);
        
        // Check if RMS is above threshold
        return rms > threshold;
    }
    
    // Process audio data for API consumption
    async processAudioChunk(audioChunk, targetSampleRate = 16000) {
        if (!this.audioContext) {
            console.error('🔴 Audio context not initialized');
            return audioChunk;
        }
        
        try {
            console.log('🔄 Processing audio chunk...');
            
            // Convert Blob to ArrayBuffer
            const arrayBuffer = await audioChunk.arrayBuffer();
            console.log('✅ Converted blob to ArrayBuffer');
            
            // Decode audio data
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('✅ Decoded audio data, duration:', audioBuffer.duration.toFixed(2), 'seconds');
            
            // Check if the audio contains speech
            const containsSpeech = this.hasSpeech(audioBuffer);
            if (!containsSpeech) {
                console.log('⚠️ Audio segment contains no detectable speech');
            } else {
                console.log('✅ Speech detected in audio segment');
            }
            
            // Optionally resample to target sample rate
            let processedBuffer = audioBuffer;
            if (audioBuffer.sampleRate !== targetSampleRate) {
                console.log('🔄 Resampling audio from', audioBuffer.sampleRate, 'Hz to', targetSampleRate, 'Hz');
                try {
                    const resampledBuffer = await this.resampleAudio(audioBuffer, targetSampleRate);
                    if (resampledBuffer) {
                        processedBuffer = resampledBuffer;
                        console.log('✅ Resampling successful');
                    } else {
                        console.log('⚠️ Resampling failed, using original audio buffer');
                    }
                } catch (resampleError) {
                    console.error('🔴 Resampling error:', resampleError);
                    console.log('⚠️ Using original audio buffer due to resampling error');
                }
            } else {
                console.log('ℹ️ Audio already at target sample rate:', targetSampleRate, 'Hz');
            }
            
            // Convert to WAV format
            console.log('🔄 Converting to WAV format...');
            const wavBlob = this.convertToWav(processedBuffer);
            console.log('✅ WAV conversion complete, size:', wavBlob.size, 'bytes');
            
            return wavBlob;
        } catch (error) {
            console.error('🔴 Error processing audio chunk:', error);
            return audioChunk; // Return original on error
        }
    }
    
    // Resample audio to a different sample rate
    async resampleAudio(audioBuffer, targetSampleRate) {
        // Skip if already at target rate
        if (audioBuffer.sampleRate === targetSampleRate) {
            return audioBuffer;
        }
        
        try {
            const originalSampleRate = audioBuffer.sampleRate;
            const ratio = targetSampleRate / originalSampleRate;
            const originalLength = audioBuffer.length;
            const newLength = Math.round(originalLength * ratio);
            
            // Create a new buffer with the target sample rate
            const offlineContext = new OfflineAudioContext(
                audioBuffer.numberOfChannels,
                newLength,
                targetSampleRate
            );
            
            // Create a source from the original buffer
            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineContext.destination);
            
            // Start the source and render
            source.start(0);
            
            // StartRendering returns a Promise, so we need to await it
            const resampledBuffer = await offlineContext.startRendering();
            console.log(`Resampled audio from ${originalSampleRate}Hz to ${targetSampleRate}Hz`);
            
            return resampledBuffer;
        } catch (error) {
            console.error('Error resampling audio:', error);
            return audioBuffer; // Return original on error
        }
    }
}

// UI State Management
class UIStateManager {
    constructor() {
        this.states = {
            READY: 'ready',
            LISTENING: 'listening',
            PROCESSING: 'processing',
            ERROR: 'error'
        };
        
        this.currentState = this.states.READY;
    }
    
    updateState(newState) {
        this.currentState = newState;
        
        // Use direct document.querySelector instead of $ utility function
        const statusDot = document.querySelector('#status-dot');
        // statusText and recordBtn might not exist, so handle them carefully
        const statusText = document.querySelector('#status-text');
        const recordBtn = document.querySelector('#toggle'); // Updated to use the toggle button ID
        
        // Only proceed if we have a status dot element
        if (statusDot) {
            // Update status indicator
            statusDot.className = ''; // Reset classes
            
            switch (newState) {
                case this.states.READY:
                    if (statusText) statusText.textContent = 'Ready';
                    if (recordBtn) recordBtn.classList.remove('recording');
                    break;
                    
                case this.states.LISTENING:
                    if (statusText) statusText.textContent = 'Listening...';
                    statusDot.classList.add('listening');
                    if (recordBtn) recordBtn.classList.add('recording');
                    break;
                    
                case this.states.PROCESSING:
                    if (statusText) statusText.textContent = 'Processing...';
                    statusDot.classList.add('processing');
                    if (recordBtn) recordBtn.classList.add('recording');
                    break;
                    
                case this.states.ERROR:
                    if (statusText) statusText.textContent = 'Error';
                    statusDot.classList.add('error');
                    if (recordBtn) recordBtn.classList.remove('recording');
                    break;
            }
        } else {
            console.warn('Status dot element not found');
        }
        
        return newState;
    }
}

// API Key Management
class APIKeyManager {
    constructor() {
        this.openAIStorageKey = 'openai_api_key';
        this.elevenLabsStorageKey = 'elevenlabs_api_key';
    }
    
    saveAPIKey(key) {
        if (!key) return false;
        
        try {
            localStorage.setItem(this.openAIStorageKey, key);
            return true;
        } catch (error) {
            console.error('Failed to save OpenAI API key:', error);
            return false;
        }
    }
    
    saveElevenLabsAPIKey(key) {
        if (!key) return false;
        
        try {
            localStorage.setItem(this.elevenLabsStorageKey, key);
            return true;
        } catch (error) {
            console.error('Failed to save ElevenLabs API key:', error);
            return false;
        }
    }
    
    getAPIKey() {
        return localStorage.getItem(this.openAIStorageKey) || '';
    }
    
    getElevenLabsAPIKey() {
        return localStorage.getItem(this.elevenLabsStorageKey) || '';
    }
    
    hasValidAPIKey() {
        const key = this.getAPIKey();
        return key && key.startsWith('sk-') && key.length > 20;
    }
    
    hasValidElevenLabsAPIKey() {
        const key = this.getElevenLabsAPIKey();
        return key && key.length > 20;
    }
    
    updateKeyStatus() {
        const openAIStatusElement = $('#api-key-status-text');
        const apiKeyInput = $('#api-key');
        const apiKeyStatus = document.querySelector('.api-key-status');
        
        if (this.hasValidAPIKey()) {
            openAIStatusElement.textContent = '✓ Valid OpenAI API key connected';
            openAIStatusElement.style.color = 'var(--success-color)';
            apiKeyStatus.classList.add('active');
            apiKeyInput.value = this.getAPIKey();
        } else {
            openAIStatusElement.textContent = 'Please enter your OpenAI API key';
            openAIStatusElement.style.color = '';
            apiKeyStatus.classList.remove('active');
        }
        
        const elevenLabsStatusElement = $('#elevenlabs-api-key-status-text');
        const elevenLabsApiKeyInput = $('#elevenlabs-api-key');
        
        if (this.hasValidElevenLabsAPIKey()) {
            elevenLabsStatusElement.textContent = '✓ Valid ElevenLabs API key connected';
            elevenLabsStatusElement.style.color = 'var(--success-color)';
            elevenLabsApiKeyInput.value = this.getElevenLabsAPIKey();
        } else {
            elevenLabsStatusElement.textContent = 'Please enter your ElevenLabs API key';
            elevenLabsStatusElement.style.color = '';
        }
    }
}

// Theme Management
class ThemeManager {
    constructor() {
        this.storageKey = 'theme_preference';
        this.themes = {
            LIGHT: 'light-mode',
            DARK: 'dark-mode'
        };
    }
    
    initialize() {
        // Set initial theme based on saved preference or system preference
        const savedTheme = localStorage.getItem(this.storageKey);
        
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.setTheme(this.themes.DARK);
        }
        
        this.updateToggleButton();
    }
    
    toggleTheme() {
        const currentTheme = document.body.classList.contains(this.themes.DARK) 
            ? this.themes.DARK 
            : this.themes.LIGHT;
            
        const newTheme = currentTheme === this.themes.DARK 
            ? this.themes.LIGHT 
            : this.themes.DARK;
            
        this.setTheme(newTheme);
        this.updateToggleButton();
        
        return newTheme;
    }
    
    setTheme(theme) {
        // Remove all theme classes and add the selected one
        document.body.classList.remove(this.themes.LIGHT, this.themes.DARK);
        document.body.classList.add(theme);
        
        // Save preference
        localStorage.setItem(this.storageKey, theme);
    }
    
    updateToggleButton() {
        const toggleIcon = $('#theme-toggle-btn i');
        
        if (document.body.classList.contains(this.themes.DARK)) {
            toggleIcon.className = 'fas fa-sun';
        } else {
            toggleIcon.className = 'fas fa-moon';
        }
    }
}

// Copy to clipboard functionality
function copyToClipboard(text) {
    if (!text) return false;
    
    try {
        navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        
        // Fallback method
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (fallbackError) {
            console.error('Fallback clipboard copy failed:', fallbackError);
            document.body.removeChild(textarea);
            return false;
        }
    }
}