import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
const prisma = new PrismaClient();
async function main() {
    const existing = await prisma.event.findFirst({
        orderBy: { createdAt: 'asc' },
    });
    if (existing) {
        console.log('Demo event already exists.');
        return;
    }
    const pepper = process.env.HOST_PIN_PEPPER ?? 'development-pepper';
    const hostPinHash = createHash('sha256').update(`host:${pepper}`).digest('hex');
    await prisma.event.create({
        data: {
            name: "The Ton's Claw",
            status: 'OPEN',
            hostTokenHash: createHash('sha256').update(`host:${Date.now()}`).digest('hex'),
            hostPinHash,
            removeWinnerAfterPick: true,
            currentRound: 1,
        },
    });
    console.log('Created the initial ball event.');
}
main()
    .catch((error) => {
    console.error('Unable to seed Prisma demo data:', error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
