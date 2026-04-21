
## Remove "ROI & Time Saved" Tab from Analytics

Strip out the ROI tab and its entire content panel from the Analytics page, leaving only the Overview content as the single view.

### Changes to `src/pages/Analytics.tsx`

1. **Remove tab navigation** — Delete the `<Tabs>`, `<TabsList>`, and `<TabsTrigger>` wrappers since there's only one view left. Keep the Overview content rendering directly.
2. **Remove ROI TabsContent** — Delete the entire `<TabsContent value="roi">` block (cost comparison card, time savings summary, ROI stat cards).
3. **Clean up unused code**:
   - Remove `activeTab` state
   - Remove `HOURLY_RATE` constant
   - Remove ROI calculations (`humanHours`, `humanCost`, `aiCost`, `savings`, `savingsPercentage`)
   - Remove unused imports: `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, `Card`, `DollarSign`, `Users`

### Result
The Analytics page renders the Overview content (stat cards, call volume chart, outcomes pie, agent performance) directly under the page header — no tab switcher.
