import gulf from "@/assets/spaces/team-gulf.jpg";
import eg from "@/assets/spaces/team-eg.jpg";
import sham from "@/assets/spaces/team-sham.jpg";
import maghreb from "@/assets/spaces/team-maghreb.jpg";
import iraq from "@/assets/spaces/team-iraq.jpg";
import sudan from "@/assets/spaces/team-sudan.jpg";
import yemen from "@/assets/spaces/team-yemen.jpg";
import type { Region } from "./team-portraits";

/** صورة فريق افتراضية للمشروع بلا صورة — بزي بلد المستخدم المختار. */
const covers: Record<Region, string> = { gulf, eg, sham, maghreb, iraq, sudan, yemen };

export function spaceCoverOf(region: Region): string {
  return covers[region] ?? eg;
}
