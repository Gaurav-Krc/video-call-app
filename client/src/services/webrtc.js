import React from 'react'

export const createPeerConnection = (roomId) => {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (e) => {
        if (e.candidate) {
            socket.emit('ice-candidate', {
                roomId,
                candidate: e.candidate
            });
        }
    };

    return pc;
};

export const handleRoomParticipants = async (roomId) => {
    const [participants] = await pool.promise().query(
        'SELECT socket_id FROM participants WHERE room_id = ?',
        [roomId]
    );
    return participants.map(p => p.socket_id);
};