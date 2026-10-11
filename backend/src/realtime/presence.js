// ====================================================================
// Presence registry: siapa (sessionId, absen) yang MASIH terhubung via Socket.IO.
// In-memory, satu instance. Tidak ada timer/polling — cek dilakukan on-demand
// tepat saat ada pendatang dengan nomor absen yang sama (lihat participants.controller).
// Keluar normal (leave_session / disconnect) membebaskan slot secara sinkron,
// sehingga pemilik lama bisa langsung balik tanpa waktu tunggu.
// ====================================================================

const normalize = (value) =>
    value === undefined || value === null ? "" : String(value).trim();

const slotKey = (sessionId, absen) => `${normalize(sessionId)}::${normalize(absen)}`;

// socket.id -> { sessionId, participantId, absen }
const bySocket = new Map();

// "sessionId::absen" -> Set<socket.id> (satu pemilik boleh buka multi-tab)
const bySlot = new Map();

export const registerPresence = (socketId, identity = {}) => {
    if (!socketId) return false;

    const sessionId = normalize(identity.sessionId ?? identity.session_id);
    const absen = normalize(identity.absen);
    if (!sessionId || !absen) return false;

    // Pastikan satu socket tidak menempati dua slot sekaligus.
    unregisterBySocket(socketId);

    const participantId = normalize(identity.participantId ?? identity.participant_id);
    bySocket.set(socketId, { sessionId, participantId, absen });

    const key = slotKey(sessionId, absen);
    if (!bySlot.has(key)) bySlot.set(key, new Set());
    bySlot.get(key).add(socketId);

    return true;
};

export const unregisterBySocket = (socketId) => {
    if (!socketId) return false;

    const entry = bySocket.get(socketId);
    if (!entry) return false;

    bySocket.delete(socketId);

    const key = slotKey(entry.sessionId, entry.absen);
    const slot = bySlot.get(key);
    if (slot) {
        slot.delete(socketId);
        if (slot.size === 0) bySlot.delete(key);
    }

    return true;
};

// Dipakai controller join: true = masih ada perangkat lain yang terhubung
// dengan (sessionId, absen) ini sekarang juga.
export const isSlotOnline = (sessionId, absen) => {
    const slot = bySlot.get(slotKey(sessionId, absen));
    return Boolean(slot && slot.size > 0);
};

export const presenceApi = {
    registerPresence,
    unregisterBySocket,
    isSlotOnline,
};
