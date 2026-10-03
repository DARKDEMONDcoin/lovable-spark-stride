import { GRAPH_BASE } from "./graph-version";
/**
 * قراءة أداء الحملات الإعلانية عبر وكيل Pipedream — بلا أي توكن لدينا.
 * ميتا (فيسبوك/إنستجرام) عبر Marketing API.
 */
import { proxyRequest, type PipedreamConfig } from "./pipedream.server";

type AdAccounts = { data?: { id: string; name?: string; currency?: string }[] };
type Insights = {
  data?: {
    campaign_id?: string;
    campaign_name?: string;
    spend?: string;
    impressions?: string;
    clicks?: string;
    ctr?: string;
    cpc?: string;
    actions?: { action_type: string; value: string }[];
  }[];
};

/** ملخص أداء آخر ٣٠ يوماً لحملات ميتا. */
export async function metaAdsSummary(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
): Promise<string> {
  const accounts = await proxyRequest<AdAccounts>(config, {
    workspaceId,
    accountId,
    url: `${GRAPH_BASE}/me/adaccounts?fields=id,name,currency&limit=5`,
  });
  const act = accounts.data?.[0];
  if (!act) return "لا حساب إعلاني مرتبط.";

  const url =
    `${GRAPH_BASE}/${act.id}/insights?` +
    new URLSearchParams({
      level: "campaign",
      date_preset: "last_30d",
      fields: "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions",
      limit: "15",
    }).toString();

  const res = await proxyRequest<Insights>(config, { workspaceId, accountId, url });
  const rows = res.data ?? [];
  if (!rows.length) return `الحساب الإعلاني ${act.name ?? act.id}: لا بيانات في آخر ٣٠ يوماً.`;

  const lines = rows.map((r) => {
    const leads =
      r.actions?.find((a) => a.action_type === "lead" || a.action_type === "purchase")?.value ??
      "-";
    return `- ${r.campaign_name ?? "?"} | صرف: ${r.spend ?? "-"} ${act.currency ?? ""} | ظهور: ${r.impressions ?? "-"} | نقرات: ${r.clicks ?? "-"} | CTR: ${r.ctr ?? "-"} | CPC: ${r.cpc ?? "-"} | تحويلات: ${leads}`;
  });
  // كشف الحملات الخاسرة: صرف معتبر بلا تحويلات، أو تكلفة نقرة أعلى من ضعف المتوسط.
  const conv = (r: (typeof rows)[number]) =>
    Number(r.actions?.find((a) => a.action_type === "lead" || a.action_type === "purchase")?.value ?? 0);
  const spends = rows.map((r) => Number(r.spend ?? 0));
  const avgSpend = spends.reduce((a, b) => a + b, 0) / Math.max(spends.length, 1);
  const cpcs = rows.map((r) => Number(r.cpc ?? 0)).filter((n) => n > 0);
  const avgCpc = cpcs.reduce((a, b) => a + b, 0) / Math.max(cpcs.length, 1);
  const losers = rows.filter((r) => {
    const spend = Number(r.spend ?? 0);
    if (!r.campaign_id || spend <= 0) return false;
    return (conv(r) === 0 && spend >= Math.max(avgSpend * 0.5, 1)) || (avgCpc > 0 && Number(r.cpc ?? 0) > avgCpc * 2);
  });
  const loserBlock = losers.length
    ? `\n\nحملات خاسرة مرشحة للإيقاف (اقترح على المالك إيقافها عبر الإجراء adam-meta-toggle بـ objectId وstatus=PAUSED، ولا توقف شيئاً بلا اعتماده):\n${losers
        .map((r) => `- ${r.campaign_name ?? "?"} | objectId=${r.campaign_id} | صرف ${r.spend} ${act.currency ?? ""} | تحويلات ${conv(r)} | CPC ${r.cpc ?? "-"}`)
        .join("\n")}`
    : "";
  return `الحساب: ${act.name ?? act.id}\n${lines.join("\n")}${loserBlock}`;
}
