export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">pkg-compliance</h1>
      <p className="max-w-xl text-center text-neutral-500">
        Packaging compliance qualification screening and evidence assembly.
        Upload a bill of materials with supporting evidence to receive a
        qualification report, questionnaire responses and a screening-grade
        product carbon footprint.
      </p>
      {/* lang-ok: stating what the product is NOT (brief §1) */}
      <p className="max-w-xl text-center text-sm text-neutral-400">
        This tool performs qualification screening only. It does not issue a
        Declaration of Conformity or any form of certification.
      </p>
    </main>
  );
}
