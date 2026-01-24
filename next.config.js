// next.config.js (ESM)
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
    typedRoutes: true,
    transpilePackages: ["react-konva", "konva"],
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            canvas: false,
        };
        return config;
    },
};

export default nextConfig;