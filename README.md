# ExoVM-webiOS

This project hosts a minimal web interface for running QEMU-based virtual machines on iOS browsers. It relies on Safari's JIT via a service worker that enables cross-origin isolation.

## Running locally

1. Install dependencies:
   ```bash
   npm install
   ```
   (Installs Puppeteer used for basic tests.)
2. Start a local server from the project directory:
   ```bash
   npx http-server -p 8080 -a 127.0.0.1
   ```
3. Visit `http://127.0.0.1:8080` in Safari on your iOS device.
4. Use the VM manager to create a VM, upload an ISO, and start the VM. Graphics mode can be toggled with the checkbox.

The repository includes local copies of `xterm.js` and `xterm-pty.js` under `vendor/` to avoid fetching them from a CDN.

## Notes
* Persistent storage is provided via IndexedDB (`/persistent` directory in the VM).
* The service worker located at `emulator/coi-serviceworker.js` ensures cross-origin isolation for proper JIT operation.
