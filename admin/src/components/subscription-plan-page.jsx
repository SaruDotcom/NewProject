import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, SectionCard } from "@/components/admin-ui";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";

const PLAN_ENDPOINT = "/admin/subscription-plan";
const PERIODS = ["MONTHLY", "YEARLY"];

function periodLabel(period) {
  return period === "YEARLY" ? "year" : "month";
}

export function SubscriptionPlanPage() {
  const [plans, setPlans] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [planCounts, setPlanCounts] = useState({});
  const [featureDrafts, setFeatureDrafts] = useState({});
  const [newFeature, setNewFeature] = useState({});
  const [newPlan, setNewPlan] = useState({
    name: "",
    price: 0,
    billingPeriod: "MONTHLY",
    description: "",
    taxNote: "Taxes may apply.",
    isActive: true,
    recommended: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiGet(PLAN_ENDPOINT);
      setPlans(result.plans || []);
      setSubscribers(result.subscribers || []);
      setPlanCounts(result.planCounts || {});
      setFeatureDrafts(Object.fromEntries((result.plans || []).flatMap((plan) => (
        plan.features.map((feature) => [feature.id, feature.title])
      ))));
    } catch (loadError) {
      setError(loadError.message || "Unable to load subscription plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  const replacePlan = (updatedPlan) => {
    setPlans((current) => current.map((plan) => plan.id === updatedPlan.id ? updatedPlan : plan));
  };

  const savePlan = async (plan) => {
    setSaving(true);
    setError("");
    try {
      const result = await apiPut(`${PLAN_ENDPOINT}/${plan.id}`, {
        name: plan.name,
        price: Number(plan.price),
        billingPeriod: plan.billingPeriod,
        description: plan.description,
        taxNote: plan.taxNote,
        isActive: plan.isActive,
        recommended: plan.recommended,
      });
      replacePlan(result.plan);
      toast.success("Subscription plan saved.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save subscription plan.");
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiPost(PLAN_ENDPOINT, { ...newPlan, price: Number(newPlan.price) });
      setPlans((current) => [...current, result.plan]);
      setPlanCounts((current) => ({ ...current, [result.plan.id]: 0 }));
      setNewPlan({
        name: "",
        price: 0,
        billingPeriod: "MONTHLY",
        description: "",
        taxNote: "Taxes may apply.",
        isActive: true,
        recommended: false,
      });
      toast.success("Subscription plan created.");
    } catch (createError) {
      setError(createError.message || "Unable to create subscription plan.");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (plan) => {
    if (!window.confirm(`Delete ${plan.name}? Existing subscriptions will remain unchanged.`)) return;
    try {
      await apiDelete(`${PLAN_ENDPOINT}/${plan.id}`);
      setPlans((current) => current.filter((item) => item.id !== plan.id));
      toast.success("Subscription plan deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete subscription plan.");
    }
  };

  const movePlan = async (plan, direction) => {
    const ordered = [...plans].sort((left, right) => left.order - right.order);
    const index = ordered.findIndex((item) => item.id === plan.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    try {
      const result = await apiPatch(`${PLAN_ENDPOINT}/reorder`, { planIds: ordered.map((item) => item.id) });
      setPlans(result.plans || []);
    } catch (reorderError) {
      setError(reorderError.message || "Unable to reorder subscription plans.");
    }
  };

  const addFeature = async (event, plan) => {
    event.preventDefault();
    const title = (newFeature[plan.id] || "").trim();
    if (!title) return;
    try {
      const result = await apiPost(`${PLAN_ENDPOINT}/${plan.id}/features`, { title, enabled: true });
      replacePlan(result.plan);
      setFeatureDrafts((current) => ({ ...current, [result.plan.features.at(-1).id]: result.plan.features.at(-1).title }));
      setNewFeature((current) => ({ ...current, [plan.id]: "" }));
    } catch (featureError) {
      setError(featureError.message || "Unable to add plan feature.");
    }
  };

  const updateFeature = async (plan, feature, updates) => {
    try {
      const result = await apiPatch(`${PLAN_ENDPOINT}/${plan.id}/features/${feature.id}`, updates);
      replacePlan(result.plan);
      if (updates.title) toast.success("Plan feature updated.");
    } catch (featureError) {
      setError(featureError.message || "Unable to update plan feature.");
    }
  };

  const removeFeature = async (plan, feature) => {
    try {
      const result = await apiDelete(`${PLAN_ENDPOINT}/${plan.id}/features/${feature.id}`);
      replacePlan(result.plan);
    } catch (featureError) {
      setError(featureError.message || "Unable to remove plan feature.");
    }
  };

  const moveFeature = async (plan, feature, direction) => {
    const ordered = [...plan.features].sort((left, right) => left.order - right.order);
    const index = ordered.findIndex((item) => item.id === feature.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    try {
      const result = await apiPatch(`${PLAN_ENDPOINT}/${plan.id}/features/reorder`, {
        featureIds: ordered.map((item) => item.id),
      });
      replacePlan(result.plan);
    } catch (reorderError) {
      setError(reorderError.message || "Unable to reorder plan features.");
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading subscription plans...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Subscription Plans" description="Manage plans, features, and subscribed wholesalers." />
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <SectionCard title="Add a plan" description="New prices apply only to purchases made after the change.">
        <form onSubmit={createPlan} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="new-plan-name">Plan name</Label>
            <Input id="new-plan-name" value={newPlan.name} onChange={(event) => setNewPlan({ ...newPlan, name: event.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-plan-price">Price (₹)</Label>
            <Input id="new-plan-price" type="number" min="0" step="0.01" value={newPlan.price} onChange={(event) => setNewPlan({ ...newPlan, price: Number(event.target.value) })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-plan-period">Billing period</Label>
            <select id="new-plan-period" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newPlan.billingPeriod} onChange={(event) => setNewPlan({ ...newPlan, billingPeriod: event.target.value })}>
              {PERIODS.map((period) => <option key={period} value={period}>{period === "YEARLY" ? "Yearly" : "Monthly"}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-plan-description">Description</Label>
            <Input id="new-plan-description" value={newPlan.description} onChange={(event) => setNewPlan({ ...newPlan, description: event.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Switch checked={newPlan.recommended} onCheckedChange={(recommended) => setNewPlan({ ...newPlan, recommended })} />
            Recommended
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={saving || !newPlan.name.trim()}><Plus className="mr-2 h-4 w-4" />Add plan</Button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        {[...plans].sort((left, right) => left.order - right.order).map((plan, index, ordered) => (
          <SectionCard
            key={plan.id}
            title={plan.name}
            description={`${planCounts[plan.id] || 0} subscribers`}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted p-4">
                <div>
                  <p className="text-2xl font-black">₹{Number(plan.price).toLocaleString("en-IN")}<span className="text-sm font-semibold text-muted-foreground"> / {periodLabel(plan.billingPeriod)}</span></p>
                  {plan.recommended && <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Recommended</span>}
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="icon" aria-label="Move plan up" disabled={index === 0} onClick={() => void movePlan(plan, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="icon" aria-label="Move plan down" disabled={index === ordered.length - 1} onClick={() => void movePlan(plan, 1)}><ArrowDown className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Plan name</Label>
                  <Input value={plan.name} onChange={(event) => replacePlan({ ...plan, name: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Price (₹)</Label>
                  <Input type="number" min="0" step="0.01" value={plan.price} onChange={(event) => replacePlan({ ...plan, price: Number(event.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Billing period</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={plan.billingPeriod} onChange={(event) => replacePlan({ ...plan, billingPeriod: event.target.value })}>
                    {PERIODS.map((period) => <option key={period} value={period}>{period === "YEARLY" ? "Yearly" : "Monthly"}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tax note</Label>
                  <Input value={plan.taxNote} onChange={(event) => replacePlan({ ...plan, taxNote: event.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description</Label>
                  <textarea className="min-h-16 w-full rounded-md border bg-background px-3 py-2 text-sm" value={plan.description} onChange={(event) => replacePlan({ ...plan, description: event.target.value })} />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-y py-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Switch checked={plan.isActive} onCheckedChange={(isActive) => replacePlan({ ...plan, isActive })} />
                  Available for new purchases
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Switch checked={plan.recommended} onCheckedChange={(recommended) => replacePlan({ ...plan, recommended })} />
                  Recommended
                </label>
              </div>

              <div>
                <h3 className="mb-3 font-bold">Features</h3>
                <div className="space-y-2">
                  {[...plan.features].sort((left, right) => left.order - right.order).map((feature, featureIndex, orderedFeatures) => (
                    <div key={feature.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                      <div className="flex gap-1">
                        <Button type="button" variant="outline" size="icon" aria-label="Move feature up" disabled={featureIndex === 0} onClick={() => void moveFeature(plan, feature, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button type="button" variant="outline" size="icon" aria-label="Move feature down" disabled={featureIndex === orderedFeatures.length - 1} onClick={() => void moveFeature(plan, feature, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      </div>
                      <Input className="min-w-32 flex-1" value={featureDrafts[feature.id] ?? feature.title} onChange={(event) => setFeatureDrafts({ ...featureDrafts, [feature.id]: event.target.value })} aria-label="Feature title" />
                      <Button type="button" variant="outline" size="icon" aria-label="Save feature" onClick={() => void updateFeature(plan, feature, { title: featureDrafts[feature.id] ?? feature.title })}><Save className="h-4 w-4" /></Button>
                      <Switch checked={feature.enabled} onCheckedChange={(enabled) => void updateFeature(plan, feature, { enabled })} aria-label="Feature enabled" />
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove feature" onClick={() => void removeFeature(plan, feature)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
                <form onSubmit={(event) => void addFeature(event, plan)} className="mt-3 flex gap-2">
                  <Input value={newFeature[plan.id] || ""} onChange={(event) => setNewFeature({ ...newFeature, [plan.id]: event.target.value })} placeholder="Add a plan feature" aria-label="New feature title" />
                  <Button type="submit" disabled={!(newFeature[plan.id] || "").trim()}><Plus className="mr-2 h-4 w-4" />Add</Button>
                </form>
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <Button type="button" variant="destructive" onClick={() => void deletePlan(plan)}><Trash2 className="mr-2 h-4 w-4" />Delete plan</Button>
                <Button type="button" onClick={() => void savePlan(plan)} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save plan"}</Button>
              </div>
            </div>
          </SectionCard>
        ))}
        {!plans.length && <p className="rounded-lg border p-6 text-sm text-muted-foreground">No plans are configured.</p>}
      </div>

      <SectionCard title="Subscribed wholesalers" description={`${subscribers.length} recorded subscriptions`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="p-3">Business</th><th className="p-3">Owner</th><th className="p-3">Email</th><th className="p-3">Plan</th><th className="p-3">Price</th><th className="p-3">Status</th><th className="p-3">Renewal date</th></tr></thead>
            <tbody>
              {subscribers.map((subscriber) => (
                <tr key={subscriber._id} className="border-b last:border-0">
                  <td className="p-3 font-semibold">{subscriber.wholesaler?.businessName || "Not provided"}</td>
                  <td className="p-3">{subscriber.user?.name || "Not provided"}</td>
                  <td className="p-3">{subscriber.user?.email || "Not provided"}</td>
                  <td className="p-3">{subscriber.planName}</td>
                  <td className="p-3">₹{Number(subscriber.amount).toLocaleString("en-IN")} / {periodLabel(subscriber.billingPeriod)}</td>
                  <td className="p-3">{subscriber.status}</td>
                  <td className="p-3">{subscriber.renewalDate ? new Date(subscriber.renewalDate).toLocaleDateString("en-IN") : "Not scheduled"}</td>
                </tr>
              ))}
              {!subscribers.length && <tr><td colSpan="7" className="p-6 text-center text-muted-foreground">No subscriptions recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
