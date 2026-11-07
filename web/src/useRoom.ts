import { useEffect, useRef, useState } from "react";
import { api, type Command, type Receipt, type Snapshot } from "./types";
import { createId } from "./id";

type Event = {
    type: string;
    owner?: string;
    snapshot?: Snapshot;
    receipt?: Receipt;
    requestId?: string;
    error?: string;
};

export function useRoom(code: string) {
    const [snapshot, setSnapshot] = useState<Snapshot>();
    const [connection, setConnection] = useState<
        "connecting" | "live" | "reconnecting" | "displaced" | "failed"
    >("connecting");
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const socket = useRef<WebSocket | null>(null);
    const commands = useRef(new Map<string, Command>());
    const offset = useRef(0);
    useEffect(() => {
        let disposed = false,
            displaced = false,
            owner: string = createId(),
            claim = true,
            resend = false,
            retry = 500,
            timer: ReturnType<typeof setTimeout>;
        commands.current.clear();
        setSnapshot(undefined);
        setConnection("connecting");
        setError("");
        setPending(false);

        function connect() {
            if (disposed || displaced) return;
            const ws = new WebSocket(
                `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/rooms/${code}/ws?mode=${claim ? "claim" : "resume"}&owner=${owner}`,
            );
            socket.current = ws;
            ws.onmessage = (message) => {
                if (disposed) return;
                let event: Event;
                try {
                    event = JSON.parse(message.data);
                } catch {
                    return;
                }
                if (event.type === "displaced") {
                    displaced = true;
                    setConnection("displaced");
                    setError("This session is active in another tab");
                    commands.current.clear();
                    setPending(false);
                    ws.close();
                    return;
                }
                if (event.type === "owned" && event.owner) {
                    owner = event.owner;
                    claim = false;
                    retry = 500;
                    resend = true;
                    setConnection("live");
                }
                if (
                    event.requestId &&
                    (event.type === "ack" || event.type === "error")
                )
                    commands.current.delete(event.requestId);
                if (event.snapshot) {
                    const next = event.snapshot;
                    offset.current = next.serverTime - Date.now();
                    setSnapshot((previous) =>
                        !previous || next.revision >= previous.revision
                            ? next
                            : previous,
                    );
                    setConnection("live");
                    if (resend) {
                        resend = false;
                        for (const command of commands.current.values()) {
                            ws.send(JSON.stringify(command));
                        }
                    }
                }
                if (
                    (event.type === "ack" || event.type === "error") &&
                    event.requestId
                ) {
                    commands.current.delete(event.requestId);
                    setPending(commands.current.size > 0);
                }
                if (event.type === "error")
                    setError(event.error ?? "Request failed");
            };
            ws.onclose = () => {
                if (disposed || displaced) return;
                setConnection("reconnecting");
                timer = setTimeout(bootstrap, retry);
                retry = Math.min(retry * 2, 5000);
            };
        }

        function bootstrap() {
            api<Snapshot>("/rooms/" + code)
                .then((s) => {
                    if (!disposed) {
                        setSnapshot(s);
                        offset.current = s.serverTime - Date.now();
                        connect();
                    }
                })
                .catch((e) => {
                    if (!disposed) {
                        if (!e.status || e.status >= 500) {
                            setConnection("reconnecting");
                            timer = setTimeout(bootstrap, 2000);
                        } else {
                            setError(e.message);
                            setConnection("failed");
                        }
                    }
                });
        }

        bootstrap();
        return () => {
            disposed = true;
            clearTimeout(timer);
            socket.current?.close();
            socket.current = null;
        };
    }, [code]);

    function send(type: string, values: Partial<Command> = {}) {
        if (
            !snapshot ||
            connection !== "live" ||
            socket.current?.readyState !== WebSocket.OPEN
        ) {
            setError("Reconnecting — wait for the connection to return");
            return;
        }
        setError("");
        const command: Command = {
            type,
            requestId: createId(),
            roundId: snapshot.roundId,
            ...values,
        };
        commands.current.set(command.requestId, command);
        setPending(true);
        socket.current.send(JSON.stringify(command));
    }

    return { snapshot, connection, error, setError, pending, send, offset };
}
