"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Check, HelpCircle, X, Crown, Users, UserX } from "lucide-react";

interface DateOption {
  id: string;
  label: string;
  week: number;
}

interface MemberDateResponse {
  memberId: string;
  memberName: string;
  datePreferences: Record<string, string>;
}

interface AdminDateMatrixProps {
  dateOptions: DateOption[];
  responses: MemberDateResponse[];
  nonVoters: string[];
}

const MONTH_NUMBERS: Record<string, string> = {
  January: "1", February: "2", March: "3", April: "4", May: "5", June: "6",
  July: "7", August: "8", September: "9", October: "10", November: "11", December: "12",
};

function getShortLabel(label: string) {
  // "Monday, July 13th" -> "Mon 7/13"
  const day = label.split(",")[0].slice(0, 3);
  const monthMatch = label.match(/January|February|March|April|May|June|July|August|September|October|November|December/);
  const dateMatch = label.match(/(\d+)/);
  if (monthMatch && dateMatch) {
    return `${day} ${MONTH_NUMBERS[monthMatch[0]]}/${dateMatch[1]}`;
  }
  return day;
}

export function AdminDateMatrix({
  dateOptions,
  responses,
  nonVoters,
}: AdminDateMatrixProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Compute scores
  const dateScores = dateOptions.map((date) => {
    let yes = 0, maybe = 0, no = 0;
    for (const r of responses) {
      const pref = r.datePreferences[date.id];
      if (pref === "yes") yes++;
      else if (pref === "maybe") maybe++;
      else if (pref === "no") no++;
    }
    return { ...date, yes, maybe, no, score: yes * 2 + maybe };
  });

  const maxScore = Math.max(...dateScores.map((d) => d.score));

  // First date id of each week after the first, used to draw week-separator borders
  const weekStartIds = new Set(
    [...new Set(dateOptions.map((d) => d.week))]
      .filter((w) => w > 1)
      .map((w) => dateOptions.find((d) => d.week === w)?.id)
  );

  const selectedInfo = selectedDate
    ? dateScores.find((d) => d.id === selectedDate)
    : null;

  const selectedResponses = selectedDate
    ? {
        yes: responses.filter((r) => r.datePreferences[selectedDate] === "yes"),
        maybe: responses.filter((r) => r.datePreferences[selectedDate] === "maybe"),
        no: responses.filter((r) => r.datePreferences[selectedDate] === "no"),
        noResponse: responses.filter(
          (r) => !r.datePreferences[selectedDate]
        ),
      }
    : null;

  return (
    <div className="space-y-4">
      {/* Matrix */}
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-muted font-medium p-2 sticky left-0 bg-card z-10 min-w-[100px]">
                Member
              </th>
              {dateScores.map((date) => (
                <th
                  key={date.id}
                  onClick={() =>
                    setSelectedDate(selectedDate === date.id ? null : date.id)
                  }
                  className={cn(
                    "p-1.5 text-center cursor-pointer transition-colors min-w-[52px]",
                    selectedDate === date.id
                      ? "bg-amber/10"
                      : "hover:bg-card",
                    weekStartIds.has(date.id) && "border-l border-border"
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    {date.score === maxScore && date.score > 0 && (
                      <Crown className="w-3 h-3 text-amber" />
                    )}
                    <span
                      className={cn(
                        "font-medium",
                        selectedDate === date.id ? "text-amber" : "text-secondary"
                      )}
                    >
                      {getShortLabel(date.label)}
                    </span>
                    <span className="text-muted font-mono">
                      {date.yes}/{date.maybe}/{date.no}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r.memberId} className="border-t border-border/50">
                <td className="p-2 text-secondary font-medium sticky left-0 bg-card z-10 whitespace-nowrap">
                  {r.memberName}
                </td>
                {dateScores.map((date) => {
                  const pref = r.datePreferences[date.id];
                  return (
                    <td
                      key={date.id}
                      className={cn(
                        "p-1.5 text-center",
                        selectedDate === date.id && "bg-amber/5",
                        weekStartIds.has(date.id) && "border-l border-border"
                      )}
                    >
                      <div className="flex items-center justify-center">
                        {pref === "yes" ? (
                          <span className="w-6 h-6 rounded-full bg-success/15 flex items-center justify-center">
                            <Check className="w-3 h-3 text-success" />
                          </span>
                        ) : pref === "maybe" ? (
                          <span className="w-6 h-6 rounded-full bg-amber/15 flex items-center justify-center">
                            <HelpCircle className="w-3 h-3 text-amber" />
                          </span>
                        ) : pref === "no" ? (
                          <span className="w-6 h-6 rounded-full bg-error/15 flex items-center justify-center">
                            <X className="w-3 h-3 text-error" />
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-card flex items-center justify-center">
                            <span className="text-muted">-</span>
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected date detail panel */}
      {selectedInfo && selectedResponses && (
        <div className="rounded-lg border border-amber/20 bg-amber/5 p-4 space-y-3">
          <h4 className="font-heading font-semibold text-amber text-sm">
            {selectedInfo.label}
            {selectedInfo.score === maxScore && (
              <span className="ml-2 text-xs font-mono text-amber/70">Best availability</span>
            )}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-success font-medium flex items-center gap-1 mb-1">
                <Users className="w-3 h-3" />
                Can make it ({selectedResponses.yes.length})
              </p>
              <div className="space-y-0.5">
                {selectedResponses.yes.map((r) => (
                  <p key={r.memberId} className="text-xs text-secondary">{r.memberName}</p>
                ))}
                {selectedResponses.yes.length === 0 && (
                  <p className="text-xs text-muted">None</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-amber font-medium flex items-center gap-1 mb-1">
                <HelpCircle className="w-3 h-3" />
                Maybe ({selectedResponses.maybe.length})
              </p>
              <div className="space-y-0.5">
                {selectedResponses.maybe.map((r) => (
                  <p key={r.memberId} className="text-xs text-secondary">{r.memberName}</p>
                ))}
                {selectedResponses.maybe.length === 0 && (
                  <p className="text-xs text-muted">None</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-error font-medium flex items-center gap-1 mb-1">
                <UserX className="w-3 h-3" />
                Can&apos;t make it ({selectedResponses.no.length})
              </p>
              <div className="space-y-0.5">
                {selectedResponses.no.map((r) => (
                  <p key={r.memberId} className="text-xs text-secondary">{r.memberName}</p>
                ))}
                {selectedResponses.no.length === 0 && (
                  <p className="text-xs text-muted">None</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted font-medium flex items-center gap-1 mb-1">
                <Users className="w-3 h-3" />
                Didn&apos;t answer ({selectedResponses.noResponse.length})
              </p>
              <div className="space-y-0.5">
                {selectedResponses.noResponse.map((r) => (
                  <p key={r.memberId} className="text-xs text-secondary">{r.memberName}</p>
                ))}
                {selectedResponses.noResponse.length === 0 && (
                  <p className="text-xs text-muted">None</p>
                )}
              </div>
            </div>
          </div>

          {nonVoters.length > 0 && (
            <p className="text-xs text-muted">
              Haven&apos;t voted yet: {nonVoters.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
