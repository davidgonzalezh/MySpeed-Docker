import fs from 'node:fs';

let ooklaServers;
let libreServers;

export const getLibreServers = () => {
    if (libreServers) return libreServers;

    if (fs.existsSync("./data/servers/librespeed.json")) {
        libreServers = fs.readFileSync("./data/servers/librespeed.json");
        libreServers = JSON.parse(libreServers);

        return libreServers;
    }

    return [];
}

export const getOoklaServers = () => {
    if (ooklaServers) return ooklaServers;

    if (fs.existsSync("./data/servers/ookla.json")) {
        ooklaServers = fs.readFileSync("./data/servers/ookla.json");
        ooklaServers = JSON.parse(ooklaServers);

        return ooklaServers;
    }

    return [];
}

export const getByMode = (mode) => {
    if (mode === "ookla") return getOoklaServers();
    if (mode === "libre") return getLibreServers();
}