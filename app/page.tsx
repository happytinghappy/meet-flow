"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Plus, Users, Calendar, User, CalendarCheck, Mail, Check, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeSlot = string; // "day-hour", e.g. "0-9" = Monday 9am

type Member = {
  id: string;
  name: string;
  color: string;
  availability: TimeSlot[];
};

type Meeting = {
  id: string;
  title: string;
  participants: string[]; // member IDs
  datetime: TimeSlot; // single time slot
  organizer: string; // member ID
};

type Invitation = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  datetime: TimeSlot;
  sender: string; // member ID
  receiver: string; // member ID
  status: "pending" | "accepted" | "rejected";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["週一", "週二", "週三", "週四", "週五"];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const COLORS = [
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-red-500",
  "bg-yellow-500",
  "bg-cyan-500",
];

const slot = (day: number, hour: number): TimeSlot => `${day}-${hour}`;

// Helper function to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// ─── Fake initial data ────────────────────────────────────────────────────────

// 假資料：三人皆有「週三 9–11」共同空閒，方便展示
const INITIAL_MEMBERS: Member[] = [
  {
    id: "me",
    name: "我",
    color: "bg-blue-500",
    availability: [
      slot(0, 9), slot(0, 10), slot(0, 11),          // Mon 9–12
      slot(0, 14), slot(0, 15), slot(0, 16),         // Mon 14–17
      slot(2, 9),  slot(2, 10), slot(2, 11),         // Wed 9–12（共同）
      slot(3, 14), slot(3, 15), slot(3, 16),         // Thu 14–17
      slot(4, 9),  slot(4, 10),                      // Fri 9–11
    ],
  },
  {
    id: "xiao-liang",
    name: "小梁",
    color: "bg-green-500",
    availability: [
      slot(0, 9),  slot(0, 10), slot(0, 11),         // Mon 9–12
      slot(2, 9),  slot(2, 10), slot(2, 11),         // Wed 9–12（共同）
      slot(2, 14), slot(2, 15), slot(2, 16),         // Wed 14–17
      slot(4, 9),  slot(4, 10),                      // Fri 9–11
    ],
  },
  {
    id: "lu-lu",
    name: "盧盧",
    color: "bg-purple-500",
    availability: [
      slot(1, 10), slot(1, 11), slot(1, 12),         // Tue 10–13
      slot(2, 9),  slot(2, 10), slot(2, 11),         // Wed 9–12（共同）
      slot(3, 14), slot(3, 15),                      // Thu 14–16
    ],
  },
];

// ─── Schedule Grid Component ──────────────────────────────────────────────────

type DragState = {
  startDay: number;
  startHourIdx: number;
  curDay: number;
  curHourIdx: number;
  filling: boolean; // true = turning slots ON, false = turning OFF
};

function ScheduleGrid({
  availability,
  onBatchToggle,
  emerald = false,
}: {
  availability: TimeSlot[];
  onBatchToggle?: (slots: TimeSlot[], fill: boolean) => void;
  emerald?: boolean;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragging = useRef(false);

  // Commit the selection when mouse is released anywhere
  useEffect(() => {
    function handleMouseUp() {
      if (!dragging.current || !drag) return;
      const d0 = Math.min(drag.startDay, drag.curDay);
      const d1 = Math.max(drag.startDay, drag.curDay);
      const h0 = Math.min(drag.startHourIdx, drag.curHourIdx);
      const h1 = Math.max(drag.startHourIdx, drag.curHourIdx);
      const selected: TimeSlot[] = [];
      for (let d = d0; d <= d1; d++)
        for (let hi = h0; hi <= h1; hi++)
          selected.push(slot(d, HOURS[hi]));
      onBatchToggle?.(selected, drag.filling);
      dragging.current = false;
      setDrag(null);
    }
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [drag, onBatchToggle]);

  function inDragRect(d: number, hi: number): boolean {
    if (!drag) return false;
    const d0 = Math.min(drag.startDay, drag.curDay);
    const d1 = Math.max(drag.startDay, drag.curDay);
    const h0 = Math.min(drag.startHourIdx, drag.curHourIdx);
    const h1 = Math.max(drag.startHourIdx, drag.curHourIdx);
    return d >= d0 && d <= d1 && hi >= h0 && hi <= h1;
  }

  return (
    <div className="overflow-x-auto select-none">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="w-14" />
            {DAYS.map((d) => (
              <th key={d} className="p-2 text-center font-medium text-sm">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((h, hi) => (
            <tr key={h}>
              <td className="text-right pr-3 text-muted-foreground text-xs py-0.5 whitespace-nowrap">
                {h}:00
              </td>
              {DAYS.map((_, d) => {
                const s = slot(d, h);
                const active = availability.includes(s);
                const inRect = inDragRect(d, hi);

                let cellClass: string;
                if (inRect) {
                  // Preview: show what the result will be
                  cellClass = drag!.filling
                    ? "bg-primary/60 border-primary/60"
                    : "bg-muted border-border opacity-40";
                } else if (active) {
                  cellClass = emerald
                    ? "bg-emerald-400 border-emerald-400"
                    : "bg-primary border-primary";
                } else {
                  cellClass = "bg-muted border-border hover:bg-muted/60";
                }

                return (
                  <td key={d} className="p-0.5">
                    <div
                      className={`h-8 rounded border transition-colors ${cellClass} ${onBatchToggle ? "cursor-pointer" : "cursor-default"}`}
                      onMouseDown={(e) => {
                        if (!onBatchToggle) return;
                        e.preventDefault();
                        dragging.current = true;
                        setDrag({
                          startDay: d,
                          startHourIdx: hi,
                          curDay: d,
                          curHourIdx: hi,
                          filling: !active,
                        });
                      }}
                      onMouseOver={() => {
                        if (!dragging.current) return;
                        setDrag((prev) =>
                          prev ? { ...prev, curDay: d, curHourIdx: hi } : prev
                        );
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex gap-4 mb-5 text-xs text-muted-foreground">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded ${item.color}`} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function MeetFlow() {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState("xiao-liang");
  
  // Meeting & Invitation states
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>("");

  const me = members.find((m) => m.id === "me")!;
  const others = members.filter((m) => m.id !== "me");
  const viewing = members.find((m) => m.id === viewId) ?? others[0];

  const commonSlots = DAYS.flatMap((_, d) =>
    HOURS.filter((h) =>
      members.every((m) => m.availability.includes(slot(d, h)))
    ).map((h) => slot(d, h))
  );
  
  // My invitations (where I'm the receiver)
  const myInvitations = invitations.filter((inv) => inv.receiver === "me");

  function batchToggleMySlots(slots: TimeSlot[], fill: boolean) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id !== "me"
          ? m
          : {
              ...m,
              availability: fill
                ? [...new Set([...m.availability, ...slots])]
                : m.availability.filter((x) => !slots.includes(x)),
            }
      )
    );
  }

  function addMember() {
    const name = newName.trim();
    if (!name) return;
    const color = COLORS[members.length % COLORS.length];
    const newMember: Member = {
      id: `member-${Date.now()}`,
      name,
      color,
      availability: [],
    };
    setMembers((prev) => [...prev, newMember]);
    setNewName("");
    setOpen(false);
  }

  function createMeeting() {
    if (!meetingTitle.trim() || selectedParticipants.length === 0 || !selectedTimeSlot) {
      return;
    }

    const meetingId = `meeting-${generateId()}`;
    const allParticipants = [...new Set([...selectedParticipants, "me"])]; // Include organizer

    // Create meeting
    const newMeeting: Meeting = {
      id: meetingId,
      title: meetingTitle.trim(),
      participants: allParticipants,
      datetime: selectedTimeSlot,
      organizer: "me",
    };

    // Create invitations for ALL participants (including organizer)
    const newInvitations: Invitation[] = allParticipants.map((participantId) => ({
      id: `invitation-${generateId()}`,
      meetingId,
      meetingTitle: newMeeting.title,
      datetime: selectedTimeSlot,
      sender: "me",
      receiver: participantId,
      status: "pending" as const,
    }));

    setMeetings((prev) => [...prev, newMeeting]);
    setInvitations((prev) => [...prev, ...newInvitations]);

    // Reset form
    setMeetingTitle("");
    setSelectedParticipants([]);
    setSelectedTimeSlot("");
    setMeetingOpen(false);
  }

  function handleInvitationResponse(invitationId: string, accept: boolean) {
    const invitation = invitations.find((inv) => inv.id === invitationId);
    if (!invitation) return;

    // Update invitation status
    setInvitations((prev) =>
      prev.map((inv) =>
        inv.id === invitationId
          ? { ...inv, status: accept ? "accepted" : "rejected" }
          : inv
      )
    );

    // If accepting, remove the time slot from "me" user's availability
    if (accept) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === "me"
            ? {
                ...m,
                availability: m.availability.filter(
                  (slot) => slot !== invitation.datetime
                ),
              }
            : m
        )
      );
    }

    // If rejecting, add the time slot back to "me" user's availability
    // (only if no other accepted meetings exist at this time)
    if (!accept) {
      const hasOtherAcceptedMeetings = invitations.some(
        (inv) =>
          inv.id !== invitationId &&
          inv.receiver === "me" &&
          inv.datetime === invitation.datetime &&
          inv.status === "accepted"
      );

      if (!hasOtherAcceptedMeetings) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === "me" && !m.availability.includes(invitation.datetime)
              ? {
                  ...m,
                  availability: [...m.availability, invitation.datetime].sort(),
                }
              : m
          )
        );
      }
    }
  }

  function toggleParticipant(memberId: string) {
    setSelectedParticipants((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <CalendarCheck className="w-5 h-5" />
          <h1 className="text-lg font-semibold tracking-tight">MeetFlow</h1>
          <Badge variant="secondary" className="text-xs font-normal">
            Beta
          </Badge>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Tabs defaultValue="members">
          <TabsList className="mb-8 h-10">
            <TabsTrigger value="members" className="gap-1.5 text-sm">
              <Users className="w-3.5 h-3.5" />
              成員
            </TabsTrigger>
            <TabsTrigger value="my-schedule" className="gap-1.5 text-sm">
              <User className="w-3.5 h-3.5" />
              我的時間表
            </TabsTrigger>
            <TabsTrigger value="view-member" className="gap-1.5 text-sm">
              <Calendar className="w-3.5 h-3.5" />
              查看成員
            </TabsTrigger>
            <TabsTrigger value="common" className="gap-1.5 text-sm">
              <CalendarCheck className="w-3.5 h-3.5" />
              共同空閒
            </TabsTrigger>
            <TabsTrigger value="create-meeting" className="gap-1.5 text-sm">
              <Plus className="w-3.5 h-3.5" />
              創建會議
            </TabsTrigger>
            <TabsTrigger value="invitations" className="gap-1.5 text-sm">
              <Mail className="w-3.5 h-3.5" />
              我的邀請
              {myInvitations.filter(inv => inv.status === "pending").length > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px] h-4">
                  {myInvitations.filter(inv => inv.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Members ── */}
          <TabsContent value="members">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold">成員列表</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  共 {members.length} 位成員
                </p>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="w-4 h-4" />
                    加入成員
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xs">
                  <DialogHeader>
                    <DialogTitle>加入新成員</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 mt-2">
                    <Input
                      placeholder="輸入成員名稱"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addMember()}
                      autoFocus
                    />
                    <Button onClick={addMember} disabled={!newName.trim()}>
                      確認加入
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback
                        className={`${m.color} text-white text-sm font-semibold`}
                      >
                        {m.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.availability.length} 個空閒時段
                      </p>
                    </div>
                    {m.id === "me" && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        你
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── Tab 2: My Schedule ── */}
          <TabsContent value="my-schedule">
            <div className="mb-5">
              <h2 className="text-base font-semibold">我的時間表</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                點擊或拖曳選取矩形範圍來批次切換空閒時段
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <Legend
                  items={[
                    { color: "bg-primary", label: "空閒" },
                    { color: "bg-muted border border-border", label: "忙碌" },
                  ]}
                />
                <ScheduleGrid
                  availability={me.availability}
                  onBatchToggle={batchToggleMySlots}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 3: View Member ── */}
          <TabsContent value="view-member">
            <div className="mb-5">
              <h2 className="text-base font-semibold">查看成員時間表</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                選擇成員來查看他們的空閒時段
              </p>
            </div>

            {others.length === 0 ? (
              <p className="text-muted-foreground text-sm py-12 text-center">
                尚無其他成員，請先在「成員」頁加入
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-5">
                  {others.map((m) => (
                    <Button
                      key={m.id}
                      variant={viewing?.id === m.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewId(m.id)}
                    >
                      {m.name}
                    </Button>
                  ))}
                </div>

                {viewing && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback
                            className={`${viewing.color} text-white text-xs font-semibold`}
                          >
                            {viewing.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        {viewing.name} 的時間表
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Legend
                        items={[
                          { color: "bg-primary", label: "空閒" },
                          {
                            color: "bg-muted border border-border",
                            label: "忙碌",
                          },
                        ]}
                      />
                      <ScheduleGrid availability={viewing.availability} />
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Tab 4: Common Availability ── */}
          <TabsContent value="common">
            <div className="mb-5">
              <h2 className="text-base font-semibold">共同空閒時間</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                所有 {members.length} 位成員都空閒的時段
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Legend
                  items={[
                    { color: "bg-emerald-400", label: "共同空閒" },
                    { color: "bg-muted border border-border", label: "非共同" },
                  ]}
                />
                {commonSlots.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10 text-sm">
                    目前沒有共同空閒時段
                  </p>
                ) : (
                  <ScheduleGrid availability={commonSlots} emerald />
                )}
              </CardContent>
            </Card>

            {commonSlots.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {commonSlots.map((s) => {
                  const [d, h] = s.split("-").map(Number);
                  return (
                    <div
                      key={s}
                      className="text-sm px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200"
                    >
                      {DAYS[d]} {h}:00–{h + 1}:00
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 5: Create Meeting ── */}
          <TabsContent value="create-meeting">
            <div className="mb-5">
              <h2 className="text-base font-semibold">創建會議</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                選擇參與者和時間來創建會議邀請
              </p>
            </div>

            {commonSlots.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground text-sm">
                    目前沒有共同空閒時段，無法創建會議
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    請先在「我的時間表」中設定空閒時間
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6 space-y-5">
                  {/* Meeting Title */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">會議標題</label>
                    <Input
                      placeholder="輸入會議標題（例：週例會、專案討論）"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                    />
                  </div>

                  {/* Participant Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      選擇參與者 <span className="text-muted-foreground font-normal">（你會自動加入）</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {others.map((member) => (
                        <Button
                          key={member.id}
                          variant={selectedParticipants.includes(member.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleParticipant(member.id)}
                          className="justify-start gap-2"
                        >
                          <Avatar className="w-5 h-5">
                            <AvatarFallback
                              className={`${member.color} text-white text-xs font-semibold`}
                            >
                              {member.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{member.name}</span>
                        </Button>
                      ))}
                    </div>
                    {selectedParticipants.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        已選擇 {selectedParticipants.length} 位參與者（總共 {selectedParticipants.length + 1} 人含你）
                      </p>
                    )}
                  </div>

                  {/* Time Slot Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">選擇時間</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
                      {commonSlots.map((s) => {
                        const [d, h] = s.split("-").map(Number);
                        return (
                          <Button
                            key={s}
                            variant={selectedTimeSlot === s ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTimeSlot(s)}
                            className="justify-start text-xs h-auto py-2"
                          >
                            <div className="text-left">
                              <div className="font-medium">{DAYS[d]}</div>
                              <div className="text-xs opacity-80">{h}:00–{h + 1}:00</div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Create Button */}
                  <Button
                    onClick={createMeeting}
                    disabled={!meetingTitle.trim() || selectedParticipants.length === 0 || !selectedTimeSlot}
                    className="w-full"
                    size="lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    創建會議並發送邀請
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Created Meetings List */}
            {meetings.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3">已創建的會議</h3>
                <div className="space-y-2">
                  {meetings.map((meeting) => {
                    const [d, h] = meeting.datetime.split("-").map(Number);
                    return (
                      <Card key={meeting.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{meeting.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {DAYS[d]} {h}:00–{h + 1}:00
                              </p>
                              <div className="flex items-center gap-1 mt-2 flex-wrap">
                                {meeting.participants.map((pid) => {
                                  const participant = members.find((m) => m.id === pid);
                                  if (!participant) return null;
                                  return (
                                    <Avatar key={pid} className="w-6 h-6">
                                      <AvatarFallback
                                        className={`${participant.color} text-white text-xs font-semibold`}
                                      >
                                        {participant.name[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                  );
                                })}
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {meeting.participants.length} 人
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Tab 6: My Invitations ── */}
          <TabsContent value="invitations">
            <div className="mb-5">
              <h2 className="text-base font-semibold">我的邀請</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                查看和回應會議邀請
              </p>
            </div>

            {myInvitations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    目前沒有會議邀請
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {myInvitations.map((invitation) => {
                  const [d, h] = invitation.datetime.split("-").map(Number);
                  const sender = members.find((m) => m.id === invitation.sender);
                  const isPending = invitation.status === "pending";
                  const isAccepted = invitation.status === "accepted";
                  const isRejected = invitation.status === "rejected";
                  
                  // Check if this time slot is still available
                  const isTimeSlotAvailable = me.availability.includes(invitation.datetime);
                  
                  // Check if there's already an accepted meeting at this time
                  const hasConflict = invitations.some(
                    (inv) =>
                      inv.id !== invitation.id &&
                      inv.receiver === "me" &&
                      inv.datetime === invitation.datetime &&
                      inv.status === "accepted"
                  );

                  return (
                    <Card key={invitation.id} className={
                      isAccepted ? "border-emerald-200 dark:border-emerald-800" :
                      isRejected ? "border-red-200 dark:border-red-800" : 
                      hasConflict ? "border-orange-200 dark:border-orange-800" : ""
                    }>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm truncate">
                                {invitation.meetingTitle}
                              </h4>
                              {isAccepted && (
                                <Badge variant="default" className="bg-emerald-500 text-xs shrink-0">
                                  已接受
                                </Badge>
                              )}
                              {isRejected && (
                                <Badge variant="destructive" className="text-xs shrink-0">
                                  已拒絕
                                </Badge>
                              )}
                              {isPending && !hasConflict && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  待回應
                                </Badge>
                              )}
                              {isPending && hasConflict && (
                                <Badge variant="default" className="bg-orange-500 text-xs shrink-0">
                                  時間衝突
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <CalendarCheck className="w-3.5 h-3.5" />
                              <span>{DAYS[d]} {h}:00–{h + 1}:00</span>
                            </div>
                            
                            {hasConflict && isPending && (
                              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                                ⚠️ 此時段已有其他已接受的會議
                              </p>
                            )}

                            {sender && (
                              <div className="flex items-center gap-2 mt-2">
                                <Avatar className="w-5 h-5">
                                  <AvatarFallback
                                    className={`${sender.color} text-white text-xs font-semibold`}
                                  >
                                    {sender.name[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">
                                  來自 {sender.name}
                                </span>
                              </div>
                            )}
                          </div>

                          {isPending && (
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleInvitationResponse(invitation.id, true)}
                                disabled={hasConflict}
                                className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={hasConflict ? "此時段已有其他會議" : "接受邀請"}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                接受
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleInvitationResponse(invitation.id, false)}
                                className="h-8 px-3"
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                拒絕
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Statistics */}
            {myInvitations.length > 0 && (
              <div className="mt-6 grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">
                      {myInvitations.filter(inv => inv.status === "pending").length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">待回應</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                      {myInvitations.filter(inv => inv.status === "accepted").length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">已接受</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {myInvitations.filter(inv => inv.status === "rejected").length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">已拒絕</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
