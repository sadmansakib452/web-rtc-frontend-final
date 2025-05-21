"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/redux/store";
import { setCallActive, setCallUser } from "@/redux/features/call/callSlice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhoneIcon, Video } from "lucide-react";
import AudioCall from "@/components/call/audio-call";
import IncomingCallModal from "@/components/call/incoming-call-modal";
import { useWebRTC } from "@/hooks/use-webrtc";
import type { User } from "@/types/user";

export default function CallDashboard() {
  const dispatch = useDispatch();
  const { isCallActive, user: callUser } = useSelector(
    (state: RootState) => state.call
  );
  const { user } = useSelector((state: RootState) => state.auth);
  const {
    connectSocket,
    contacts,
    initiateCall,
    acceptCall,
    rejectCall,
    incomingCallData,
  } = useWebRTC();
  const [callType, setCallType] = useState<"audio" | "video">("audio");

  // 1. Connect to socket when component mounts
  useEffect(() => {
    if (user?.token) {
      connectSocket(user.token);
    }
  }, [user, connectSocket]);

  // 2. Handle starting a call
  const handleStartCall = (contact: User, type: "audio" | "video") => {
    setCallType(type);
    dispatch(setCallUser(contact));
    dispatch(setCallActive(true));
    initiateCall(contact.id, type, contact.appointmentId?.toString());
  };

  // 3. Handle accepting an incoming call
  const handleAcceptCall = () => {
    if (incomingCallData) {
      acceptCall(incomingCallData);
    }
  };

  // 4. Handle rejecting an incoming call
  const handleRejectCall = () => {
    if (incomingCallData) {
      rejectCall(incomingCallData);
    }
  };

  // 5. Show call interface if call is active
  if (isCallActive && callUser) {
    return <AudioCall callType={callType} />;
  }

  return (
    <>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Call Dashboard</h1>

        <Tabs defaultValue="contacts" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="recent">Recent Calls</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            {contacts.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No contacts available
              </p>
            ) : (
              contacts.map((contact, index) => (
                <Card
                  key={`${contact.id}-${index}`}
                  className="overflow-hidden"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={contact.img || "/placeholder.svg"}
                            alt={contact.name}
                          />
                          <AvatarFallback>
                            {contact.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{contact.name}</h3>
                          <p className="text-sm text-gray-500">
                            {contact.title || contact.type || "User"}
                          </p>
                          {contact.appointmentId && (
                            <p className="text-xs text-gray-400">
                              Appointment #{contact.appointmentId}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="rounded-full h-10 w-10 bg-[#004D49] text-white hover:bg-[#004D49]/90"
                          onClick={() => handleStartCall(contact, "audio")}
                        >
                          <PhoneIcon className="h-5 w-5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="rounded-full h-10 w-10 border-[#004D49] text-[#004D49] hover:bg-[#004D49]/10"
                          onClick={() => handleStartCall(contact, "video")}
                        >
                          <Video className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="recent">
            <p className="text-center text-gray-500 py-4">No recent calls</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Incoming Call Modal */}
      <IncomingCallModal
        isOpen={!!incomingCallData}
        callData={incomingCallData}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />
    </>
  );
}
