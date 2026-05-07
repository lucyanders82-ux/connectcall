import { useState, useEffect } from "react";
import { API_BASE } from "../constants";
import { c } from "../constants";

export function HostRating({ hostId }) {
  const [rating, setRating] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/rating/${hostId}`).then(r => r.json()).then(d => {
      if (d.average) setRating(d);
    });
  }, [hostId]);
  if (!rating || rating.count === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
      <span style={{ color: c.gold, fontSize: 13 }}>{"★".repeat(Math.round(rating.average))}{"☆".repeat(5 - Math.round(rating.average))}</span>
      <span style={{ color: c.sub, fontSize: 10 }}>({rating.count})</span>
    </div>
  );
}

export function HostResponseRate({ hostId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/response-rate/${hostId}`)
      .then(r => r.json())
      .then(d => { if (d.rate !== null) setData(d); });
  }, [hostId]);
  if (!data || data.total < 1) return null;
  const color = data.rate >= 80 ? c.green : data.rate >= 50 ? c.orange : c.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color }}>●</span>
      <span style={{ fontSize: 11, color: c.sub }}>Responds <strong style={{ color }}>{data.rate}%</strong> of the time</span>
    </div>
  );
}