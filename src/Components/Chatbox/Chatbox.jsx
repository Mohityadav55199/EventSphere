import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { MessageSquare, X } from "lucide-react";
import { IconSend } from "@tabler/icons-react";
import { useSelector } from "react-redux";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ChatBox = ({ eventId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);

  const token = useSelector((state) => state.auth.accessToken);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize socket
  useEffect(() => {
    if (!isOpen || !eventId || !token) return;

    const newSocket = io(import.meta.env.VITE_BACKEND_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("✅ Connected:", newSocket.id);
      newSocket.emit("joinRoom", { eventId });
    });

    newSocket.on("joined", (msg) => console.log(msg));

    newSocket.on("chatHistory", (history) => {
      setMessages(history);
    });

    newSocket.on("newMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    newSocket.on("typing", (userName) => setTypingUser(userName));
    newSocket.on("stopTyping", () => setTypingUser(null));

    newSocket.on("error", (err) => {
      console.error("❌ Error:", err)
      toast.error(err, { position: "top-right" });
    });

    return () => {
      newSocket.emit("leaveRoom", eventId);
      newSocket.disconnect();
    };
  }, [isOpen, eventId, token]);

  const sendMessage = () => {
    if (!message.trim()) return;
    socket?.emit("sendMessage", { roomId: eventId, message });
    setMessage("");
    socket?.emit("stopTyping", eventId);
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    socket?.emit("typing", eventId);
    setTimeout(() => socket?.emit("stopTyping", eventId), 3000);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <ToastContainer position="top-right" autoClose={5000} />
      {isOpen ? (
        <div className="w-80 h-96 bg-white shadow-lg rounded-lg flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center bg-blue-600 text-white px-3 py-2 rounded-t-lg">
            <span className="font-semibold">Event Chat</span>
            <button onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  msg.sender?.name === "You" ? "items-end" : "items-start"
                }`}
              >
                <span className="text-xs font-semibold text-gray-600">
                  {msg.sender?.name || "Unknown"}
                </span>
                <span className="bg-gray-200 p-2 rounded-lg inline-block max-w-[75%]">
                  {msg.message}
                </span>
              </div>
            ))}
            {typingUser && (
              <p className="text-xs italic text-gray-500">
                {typingUser} is typing...
              </p>
            )}
            <div ref={messagesEndRef}></div>
          </div>

          {/* Input */}
          <div className="p-2 flex items-center border-t">
            <input
              type="text"
              value={message}
              onChange={handleTyping}
              placeholder="Type a message..."
              className="flex-1 px-2 py-1 border rounded-md text-sm"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="ml-2 bg-blue-600 text-white p-2 rounded-md"
            >
              <IconSend size={18} />
            </button>
          </div>
        </div>
      ) : (
        <button
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700"
          onClick={() => setIsOpen(true)}
        >
          <MessageSquare size={22} />
        </button>
      )}
    </div>
  );
};

export default ChatBox;
