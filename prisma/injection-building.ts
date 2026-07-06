import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "./generated/client.js";

dotenv.config();

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

// Tipagens básicas para o GeoJSON
interface GeoJsonFeature {
    properties: {
        OBJECTID_1: number;
        Nome_predio?: string;
        Unidade?: string;
    };
}

interface GeoJson {
    features: GeoJsonFeature[];
}

async function main() {
    const geoJsonPath = join(
        __dirname,
        "../seed-data/segundo_ciclo_concluido.geojson"
    );
    const geoJsonRaw = readFileSync(geoJsonPath, "utf-8");
    const geoJson: GeoJson = JSON.parse(geoJsonRaw);
    const mapGeoJson = new Map(
        geoJson.features.map((feature) => [
            feature.properties.OBJECTID_1,
            feature
        ])
    );
    const roomsWithId = await prisma.room.findMany({
        where: { atlasId: { not: null } }
    });
    const roomsWithFeatures = roomsWithId.map((room) => ({
        room: room,
        feature: mapGeoJson.get(room.atlasId!)
    }));
    console.log(roomsWithFeatures);

    const featureBuildings = new Map(
        roomsWithFeatures.map(({ feature }) => [
            (feature?.properties.Unidade ?? "") +
                " - " +
                (feature?.properties.Nome_predio ?? ""),
            {
                predio: feature?.properties.Nome_predio,
                unidade: feature?.properties.Unidade
            }
        ])
    );

    console.log(featureBuildings);

    const unitsCode = new Set(
        roomsWithFeatures.map(
            ({ feature }) => feature?.properties.Unidade ?? ""
        )
    );
    const units = await prisma.unit.findMany({
        where: { code: { in: Array.from(unitsCode) } }
    });
    const unitsMap = new Map(
        [...unitsCode].map((unit) => [unit, units.find((u) => u.code === unit)])
    );
    console.log(unitsMap);
    const buildingData = Array.from(featureBuildings.entries()).map(
        ([_, value]) => ({
            code: value.predio ?? "",
            name: value.predio ?? "",
            unitId: value.unidade
                ? (unitsMap.get(value.unidade)?.id ?? null)
                : null
        })
    );
    console.log(buildingData);
    await prisma.building.createMany({
        data: buildingData,
        skipDuplicates: true
    });

    const buildings = await prisma.building.findMany({
        include: { unit: true }
    });

    for (const { room, feature } of roomsWithFeatures) {
        const building = buildings.find(
            (b) =>
                b.code === (feature?.properties.Nome_predio ?? "") &&
                b.unit?.code === (feature?.properties.Unidade ?? "")
        );
        if (building) {
            console.log(
                `Atualizando sala ${room.code} para prédio ${building.code} e unidade ${building.unit?.code}`
            );
            await prisma.room.update({
                where: { id: room.id },
                data: { buildingId: building.id }
            });
        }
    }

    return;
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("❌ Erro durante seeding:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
