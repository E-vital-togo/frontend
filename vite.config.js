import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.ico", "recvit-favicon.svg", "icons/apple-touch-icon.png"],
            manifest: {
                name: "RECVIT",
                short_name: "RECVIT",
                description: "RECVIT - Registre de l'État Civil et des Faits Vitaux du Togo",
                lang: "fr",
                // Couleurs issues du cahier d'identite RECVIT, jamais improvisees.
                theme_color: "#0B7A57",
                background_color: "#FBFDF6",
                display: "standalone",
                start_url: "/",
                icons: [
                    {
                        src: "/icons/icon-192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any"
                    },
                    {
                        src: "/icons/icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any"
                    },
                    {
                        src: "/icons/icon-maskable-192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "maskable"
                    },
                    {
                        src: "/icons/icon-maskable-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable"
                    },
                    {
                        src: "/icons/recvit-favicon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "any"
                    }
                ]
            },
            workbox: {
                // Cache-first pour l'app shell, pour un fonctionnement hors-ligne
                // reel cote agent CEC ; les appels API restent en reseau d'abord
                // et sont geres explicitement par la file Dexie (voir src/lib/db.ts),
                // pas par le service worker.
                globPatterns: ["**/*.{js,css,html,svg,woff2}"],
                runtimeCaching: [
                    {
                        urlPattern: /\/api\/v1\/territoires\/|\/api\/v1\/data-elements\/|\/api\/v1\/champs-formulaire\//,
                        handler: "StaleWhileRevalidate",
                        options: { cacheName: "evital-referentiels" }
                    }
                ]
            }
        })
    ],
    server: {
        port: 5173,
        // Vite rejette par defaut tout Host: inconnu (anti DNS-rebinding) ; on
        // liste ici les domaines ngrok fixes derriere lesquels nginx (voir
        // reverse-proxy/) relaie les requetes du front.
        allowedHosts: [
            "jaunt-jolly-expulsion.ngrok-free.dev",
            "flashy-circular-divisibly.ngrok-free.dev"
        ]
    }
});
