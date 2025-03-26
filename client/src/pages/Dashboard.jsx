import { useState, useEffect, useCallback } from "react";
import { Table, Button, Modal } from "antd";
import { PhoneOutlined } from "@ant-design/icons";
import VideoCall from "../components/VideoCall";
import useMedia from "../hooks/useMedia";
import UserSelectModal from "../components/UserSelectModal";
import { socket } from "../contexts/SocketContext";
import { v4 as uuidv4 } from "uuid";
import PermissionModal from "../components/VideoCall/PermissionModal";

const Dashboard = () => {
  const [users, setUsers] = useState([]);
  const [callModal, setCallModal] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showUserSelect, setShowUserSelect] = useState(true);
  const { localStream } = useMedia({
    onError: (error) => {
      if (error.name === "NotAllowedError") {
        setPermissionDenied(true);
      }
    },
  });
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    // Fetch users from database
    const fetchUsers = async () => {
      try {
        const response = await fetch("http://localhost:5000/users");
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // Register current user
    socket.emit("register-user", currentUser);

    // Handle incoming calls
    socket.on("incoming-call", (data) => {
      setIncomingCall(data);
    });

    // Handle call acceptance
    socket.on("call-accepted", ({ roomId }) => {
      setRoomId(roomId);
      setCallModal(true);
    });

    // Add rejection handler
    const handleCallRejected = ({ roomId }) => {
      Modal.info({
        title: "Call Rejected",
        content: "The user rejected your call",
      });
      setCallModal(false);
    };

    socket.on("call-rejected", handleCallRejected);

    return () => {
      socket.off("incoming-call");
      socket.off("call-accepted");
      socket.off("call-rejected", handleCallRejected);
    };
  }, [currentUser]);

  const handleUserSelect = (userId) => {
    setCurrentUser(userId);
    setShowUserSelect(false);
  };

  const startCall = useCallback(async (calleeId) => {
    try {
      const roomId = uuidv4();

      // Store room in database
      const response = await fetch("http://localhost:5000/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by: currentUser,
          participants: [currentUser, calleeId],
        }),
      });

      const data = await response.json();

      socket.emit("initiate-call", {
        callerId: currentUser,
        calleeId,
        roomId: data.roomId,
      });

      setRoomId(data.roomId);
      setCallModal(true);
    } catch (error) {
      console.error("Call initiation failed:", error);
    }
  });

  const handleAcceptCall = useCallback(async () => {
    try {
      // Update room with participant
      await fetch(
        `http://localhost:5000/rooms/${incomingCall.roomId}/participants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: currentUser }),
        }
      );

      socket.emit("accept-call", {
        roomId: incomingCall.roomId,
        calleeId: currentUser,
      });

      setRoomId(incomingCall.roomId);
      setCallModal(true);
      setIncomingCall(null);
    } catch (error) {
      console.error("Call acceptance failed:", error);
    }
  });

  const handleRejectCall = useCallback(() => {
    socket.emit("reject-call", {
      callerId: incomingCall.callerId,
      roomId: incomingCall.roomId,
    });
    setIncomingCall(null);
  });

  const columns = [
    { title: "Name", dataIndex: "name" },
    { title: "Email", dataIndex: "email" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {status}
        </span>
      ),
    },
    {
      title: "Action",
      render: (_, record) => (
        <Button
          icon={<PhoneOutlined />}
          onClick={() => {
            if (record.status !== "active") {
              Modal.warning({
                title: "User Unavailable",
                content:
                  "This user is currently inactive and cannot be called.",
              });
            } else {
              startCall(record.id);
            }
          }}
          disabled={record.id === currentUser || record.status === "inactive"}
        >
          Call
        </Button>
      ),
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">
        Video Chat App - {users.find((u) => u.id === currentUser)?.name}
      </h1>

      <UserSelectModal
        visible={showUserSelect}
        users={users}
        onSelect={handleUserSelect}
      />

      <Table
        columns={columns}
        dataSource={users.filter((u) => u.id !== currentUser)}
        rowKey="id"
        bordered
        pagination={false}
      />

      <Modal
        title="Incoming Call"
        open={!!incomingCall}
        onCancel={handleRejectCall}
        footer={[
          <Button key="reject" danger onClick={handleRejectCall}>
            Reject
          </Button>,
          <Button key="accept" type="primary" onClick={handleAcceptCall}>
            Accept
          </Button>,
        ]}
      >
        <p>
          Incoming call from{" "}
          {users.find((u) => u.id === incomingCall?.callerId)?.name}
        </p>
      </Modal>

      <VideoCall
        localStream={localStream}
        visible={callModal}
        setVisible={setCallModal}
        roomId={roomId}
        currentUser={currentUser}
        isCaller={!incomingCall}
      />

      <PermissionModal
        visible={permissionDenied}
        onRetry={() => {
          navigator.mediaDevices
            .getUserMedia({ audio: true, video: true })
            .then(() => setPermissionDenied(false))
            .catch(() => setPermissionDenied(true));
        }}
        onCancel={() => setPermissionDenied(false)}
      />
    </div>
  );
};

export default Dashboard;
