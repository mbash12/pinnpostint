import Link from "next/link";
import { ArrowUpRight, Plus } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { formatCurrency } from "@/utils/currency";

const kpiCards = [
    {
        title: "Total revenue",
        value: formatCurrency(128940),
        change: "+12.5%",
        description: "Compared to last month",
    },
    {
        title: "Active customers",
        value: "2,481",
        change: "+4.3%",
        description: "Active in the last 30 days",
    },
    {
        title: "New signups",
        value: "384",
        change: "+8.1%",
        description: "New users this week",
    },
    {
        title: "Support tickets",
        value: "76",
        change: "-2.4%",
        description: "Awaiting resolution",
    },
];

const recentTransactions = [
    {
        id: "INV-2108",
        customer: "Olivia Rhye",
        date: "Sep 24, 2025",
        amount: formatCurrency(1280),
        status: "Paid",
    },
    {
        id: "INV-2107",
        customer: "Phoenix Baker",
        date: "Sep 23, 2025",
        amount: formatCurrency(580),
        status: "Pending",
    },
    {
        id: "INV-2106",
        customer: "Lana Steiner",
        date: "Sep 22, 2025",
        amount: formatCurrency(2420),
        status: "Paid",
    },
    {
        id: "INV-2105",
        customer: "Demi Wilkinson",
        date: "Sep 20, 2025",
        amount: formatCurrency(760),
        status: "Overdue",
    },
];

const topPerformers = [
    {
        name: "Phoenix Baker",
        role: "Account Manager",
        metric: formatCurrency(24300),
        change: "+8.2%",
    },
    {
        name: "Olivia Rhye",
        role: "Customer Success",
        metric: formatCurrency(21750),
        change: "+5.1%",
    },
    {
        name: "Demi Wilkinson",
        role: "Sales Lead",
        metric: formatCurrency(18640),
        change: "+3.8%",
    },
];

export default function DashboardPage() {
    return (
        <div className="min-h-screen bg-primary px-4 py-8 sm:px-6 lg:px-8">
            <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Welcome back, Alex</h1>
                    <p className="text-sm text-tertiary sm:text-md">Here's what's happening with your business today.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button color="secondary" iconLeading={<ArrowUpRight />} href="#" size="md">
                        View reports
                    </Button>
                    <Button color="primary" iconLeading={<Plus />} size="md">
                        Add record
                    </Button>
                </div>
            </header>

            <main className="mx-auto mt-8 flex w-full max-w-6xl flex-col gap-8">
                <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kpiCards.map((card) => (
                        <article key={card.title} className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-tertiary uppercase tracking-wide">{card.title}</p>
                                <p className="text-display-xs font-semibold text-primary">{card.value}</p>
                                <p className="text-sm text-success-primary">{card.change}</p>
                                <p className="text-sm text-quaternary">{card.description}</p>
                            </div>
                        </article>
                    ))}
                </section>

                <section className="grid gap-6 lg:grid-cols-3">
                    <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm lg:col-span-2">
                        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-primary">Sales performance</h2>
                                <p className="text-sm text-tertiary">Revenue collected in the last 12 weeks</p>
                            </div>
                            <Button color="secondary" size="sm">
                                Download report
                            </Button>
                        </header>
                        <div className="mt-6 grid gap-4 text-sm text-tertiary md:grid-cols-3">
                            <div className="rounded-xl border border-secondary bg-secondary p-4">
                                <p className="text-xs uppercase tracking-wide text-quaternary">Current week</p>
                                <p className="mt-1 text-xl font-semibold text-primary">{formatCurrency(18240)}</p>
                                <p className="text-success-primary">+6.4%</p>
                            </div>
                            <div className="rounded-xl border border-secondary bg-secondary p-4">
                                <p className="text-xs uppercase tracking-wide text-quaternary">Average order</p>
                                <p className="mt-1 text-xl font-semibold text-primary">{formatCurrency(240)}</p>
                                <p className="text-success-primary">+3.2%</p>
                            </div>
                            <div className="rounded-xl border border-secondary bg-secondary p-4">
                                <p className="text-xs uppercase tracking-wide text-quaternary">Refund rate</p>
                                <p className="mt-1 text-xl font-semibold text-primary">1.4%</p>
                                <p className="text-error-primary">+0.3%</p>
                            </div>
                        </div>
                        <div className="mt-6 flex h-64 items-center justify-center rounded-xl border border-dashed border-secondary text-tertiary">
                            <span className="text-sm">Chart integration coming soon</span>
                        </div>
                    </article>

                    <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <header className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-primary">Top performers</h2>
                                <p className="text-sm text-tertiary">Team members leading this month</p>
                            </div>
                            <Link href="#" className="text-sm font-medium text-brand-primary hover:text-brand-secondary">
                                View all
                            </Link>
                        </header>
                        <ul className="mt-6 space-y-4">
                            {topPerformers.map((performer) => (
                                <li key={performer.name} className="flex items-center justify-between rounded-xl border border-secondary bg-secondary p-4">
                                    <div>
                                        <p className="text-sm font-semibold text-primary">{performer.name}</p>
                                        <p className="text-xs text-tertiary">{performer.role}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-primary">{performer.metric}</p>
                                        <p className="text-xs text-success-primary">{performer.change}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </article>
                </section>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-primary">Recent transactions</h2>
                            <p className="text-sm text-tertiary">Latest invoices from the past week</p>
                        </div>
                        <Button color="secondary" size="sm">
                            View all
                        </Button>
                    </header>
                    <div className="mt-6 overflow-x-auto">
                        <table className="min-w-full divide-y divide-secondary text-left text-sm">
                            <thead className="text-xs uppercase tracking-wide text-quaternary">
                                <tr>
                                    <th scope="col" className="px-4 py-3">Invoice</th>
                                    <th scope="col" className="px-4 py-3">Customer</th>
                                    <th scope="col" className="px-4 py-3">Date</th>
                                    <th scope="col" className="px-4 py-3">Amount</th>
                                    <th scope="col" className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary text-sm text-primary">
                                {recentTransactions.map((transaction) => (
                                    <tr key={transaction.id} className="transition hover:bg-secondary">
                                        <td className="px-4 py-3 font-medium text-brand-primary">{transaction.id}</td>
                                        <td className="px-4 py-3">{transaction.customer}</td>
                                        <td className="px-4 py-3 text-tertiary">{transaction.date}</td>
                                        <td className="px-4 py-3">{transaction.amount}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                                    transaction.status === "Paid"
                                                        ? "bg-success-subtle text-success-primary"
                                                        : transaction.status === "Pending"
                                                            ? "bg-warning-subtle text-warning-primary"
                                                            : "bg-error-subtle text-error-primary"
                                                }`}
                                            >
                                                {transaction.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}
