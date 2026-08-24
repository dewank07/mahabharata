/* ============================================================================
   The table. One shell, one screen per phase.

   `App.tsx` owns the Convex mutations and passes them down, so the screens stay
   presentational and each one is readable on its own.
   ========================================================================== */

import { TableShell } from "./TableShell";
import { LobbyScreen } from "./LobbyScreen";
import { NightScreen } from "./NightScreen";
import { ProposeScreen } from "./ProposeScreen";
import { VoteScreen, KingReturnsScreen } from "./VoteScreen";
import { QuestScreen, ExcaliburScreen } from "./QuestScreen";
import { LadyScreen } from "./LadyScreen";
import { AssassinScreen } from "./AssassinScreen";
import { ReckoningScreen } from "./ReckoningScreen";
import { PlotHand } from "./PlotHand";
import type { TableProps } from "./types";

export type TableActions = {
  start: () => Promise<unknown>;
  setOpts: (opts: TableProps["room"]["opts"]) => Promise<unknown>;
  changeTheme: (themeId: string) => Promise<unknown>;
  leave: () => void;
  swapSeat: (watcherId: string, seatedId: string) => Promise<unknown>;
  begin: () => Promise<unknown>;
  propose: (team: string[], excaliburId?: string) => Promise<unknown>;
  vote: (choice: "approve" | "reject") => Promise<unknown>;
  card: (card: "success" | "fail") => Promise<unknown>;
  useExcalibur: (targetId?: string) => Promise<unknown>;
  sealQuest: () => Promise<unknown>;
  useLady: (targetId: string) => Promise<unknown>;
  strike: (mode: "merlin" | "lovers", targetId: string, targetId2?: string) => Promise<unknown>;
  newGame: () => Promise<unknown>;
  dealPlot: (toId: string) => Promise<unknown>;
  playPlot: (card: string, targetId?: string) => Promise<unknown>;
  discardPlot: (card: string) => Promise<unknown>;
  playKingReturns: () => Promise<unknown>;
  passKingReturns: () => Promise<unknown>;
};

export function Table(props: TableProps & { actions: TableActions }) {
  const { room, pid, theme, voice, emblemSrc, account, worlds, act, error, actions } = props;
  const base = { room, pid, theme, emblemSrc, voice, account, worlds, act };

  return (
    <TableShell
      room={room}
      theme={theme}
      voice={voice}
      emblemSrc={emblemSrc}
      account={account}
      error={error}
    >
      {room.phase === "lobby" && (
        <LobbyScreen
          {...base}
          onStart={actions.start}
          onSwapSeat={actions.swapSeat}
          onSetOpts={actions.setOpts}
          onChangeTheme={actions.changeTheme}
          onLeave={actions.leave}
        />
      )}

      {room.phase === "reveal" && <NightScreen {...base} onBegin={actions.begin} />}

      {/* The plot deal shares the propose shell — the leader hands cards out
          before naming a party, so the board should not jump. */}
      {(room.phase === "propose" || room.phase === "plot") && (
        <ProposeScreen {...base} onPropose={actions.propose} />
      )}

      {room.phase === "vote" && <VoteScreen {...base} onVote={actions.vote} />}
      {room.phase === "quest" && <QuestScreen {...base} onCard={actions.card} />}

      {room.phase === "lady" && <LadyScreen {...base} onUse={actions.useLady} />}
      {room.phase === "assassin" && <AssassinScreen {...base} onStrike={actions.strike} />}
      {room.phase === "end" && <ReckoningScreen {...base} onNewGame={actions.newGame} />}

      {/* Overlays sit on top of whatever the last board was. */}
      {room.phase === "kingReturns" && (
        <KingReturnsScreen
          {...base}
          onPlay={actions.playKingReturns}
          onPass={actions.passKingReturns}
        />
      )}
      {room.phase === "excalibur" && (
        <ExcaliburScreen
          {...base}
          onUse={actions.useExcalibur}
          onSeal={actions.sealQuest}
        />
      )}

      {/* The hand travels with you across every phase that can play a card. */}
      <PlotHand
        {...base}
        onDeal={actions.dealPlot}
        onPlay={actions.playPlot}
        onDiscard={actions.discardPlot}
      />
    </TableShell>
  );
}
