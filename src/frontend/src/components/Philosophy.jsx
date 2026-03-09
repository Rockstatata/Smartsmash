/**
 * Philosophy section — AI Manifesto.
 * Full-width quote block emphasizing interpretable classical intelligence.
 */
export default function Philosophy() {
  return (
    <section id="philosophy" className="relative py-32 overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1461896836934-bd45ba24e913?auto=format&fit=crop&w=1920&q=80"
          alt=""
          className="w-full h-full object-cover opacity-50"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-obsidian/80" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <span className="text-xs tracking-[0.3em] uppercase text-champagne font-data">Manifesto</span>
        <blockquote className="mt-8 text-2xl md:text-4xl lg:text-5xl font-light leading-snug philosophy-text">
          Most AI platforms rely on<br className="hidden md:block" />
          black-box learning.<br />
          <span className="mt-4 block">
            We focus on{' '}
            <span className="text-champagne font-drama italic font-bold philosophy-highlight">
              interpretable
            </span>
            <br className="hidden md:block" />
            classical intelligence.
          </span>
        </blockquote>
        <div className="mt-12 w-16 h-px bg-champagne/40 mx-auto" />
      </div>
    </section>
  );
}
