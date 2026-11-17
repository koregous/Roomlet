import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - Roomlet',
  description: 'Terms of Service and content guidelines for Roomlet gallery platform',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <h1 className="text-4xl font-serif mb-8">Terms of Service</h1>
        
        <div className="space-y-8 text-gray-300">
          <section>
            <p className="text-sm text-gray-500 mb-6">Last Updated: August 9, 2026</p>
            <p className="leading-relaxed">
              By accessing or using Roomlet, you agree to be bound by these Terms of Service. 
              If you disagree with any part of these terms, you may not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">1. Acceptable Use</h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Roomlet is a creative gallery platform for artists, photographers, and creators to 
                share their work. You may use Roomlet to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Share original artwork, photography, illustrations, and creative content</li>
                <li>Organize content into galleries and collections</li>
                <li>Discover and bookmark content from other creators</li>
                <li>Build a profile to showcase your creative work</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">2. Content Guidelines</h2>
            
            <h3 className="text-xl text-white mb-3 mt-6">Allowed Content</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 leading-relaxed">
              <li>Original artwork, photography, illustrations, and digital art</li>
              <li>Comics, manga, and sequential art</li>
              <li>Character designs, concept art, and fan art</li>
              <li>NSFW artistic content (must be marked with NSFW flag)</li>
              <li>Tasteful artistic nudity and mature themes</li>
            </ul>

            <h3 className="text-xl text-white mb-3 mt-6">Prohibited Content</h3>
            <p className="text-red-400 mb-3">
              The following content is strictly prohibited and will result in immediate removal and account suspension:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 leading-relaxed">
              <li><strong className="text-white">Illegal content:</strong> Any content depicting or promoting illegal activities</li>
              <li><strong className="text-white">Child exploitation:</strong> Any sexualized content involving minors or minor-appearing characters</li>
              <li><strong className="text-white">Non-consensual content:</strong> Real or simulated non-consensual acts</li>
              <li><strong className="text-white">Extreme violence:</strong> Gore, torture, or disturbing violent imagery</li>
              <li><strong className="text-white">Bestiality:</strong> Any sexual content involving animals</li>
              <li><strong className="text-white">Hate speech:</strong> Content promoting hatred based on race, ethnicity, religion, gender, or sexual orientation</li>
              <li><strong className="text-white">Harassment:</strong> Content targeting or harassing specific individuals</li>
              <li><strong className="text-white">Misinformation:</strong> Deliberately misleading political content or harmful misinformation</li>
              <li><strong className="text-white">Spam:</strong> Mass-uploaded low-quality or repetitive content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">3. NSFW Content Rules</h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Roomlet allows NSFW (Not Safe For Work) artistic content with the following requirements:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Proper tagging:</strong> All NSFW content must be marked with the NSFW flag</li>
                <li><strong className="text-white">Opt-in viewing:</strong> Users must explicitly enable NSFW content in settings to view it</li>
                <li><strong className="text-white">Anonymous users:</strong> NSFW content is hidden from logged-out users</li>
                <li><strong className="text-white">Artistic intent:</strong> NSFW content should be artistic in nature, not purely pornographic</li>
                <li><strong className="text-white">Age verification:</strong> By enabling NSFW content, you confirm you are 18+ years old</li>
              </ul>
              <p className="mt-4 text-yellow-400">
                ⚠️ Failure to properly tag NSFW content may result in content removal or account suspension.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">4. Content Ownership & Rights</h2>
            <div className="space-y-3 leading-relaxed">
              <p><strong className="text-white">Your Content:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You retain full ownership of all content you upload</li>
                <li>You grant Roomlet a license to display, store, and share your content on the platform</li>
                <li>You must own or have permission to upload all content you share</li>
                <li>You are responsible for ensuring your content doesn't infringe on others' rights</li>
              </ul>
              
              <p className="mt-4"><strong className="text-white">Others' Content:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Do not upload content you don't have rights to</li>
                <li>Respect copyright and intellectual property rights</li>
                <li>Fan art is allowed, but must not claim to be official work</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">5. Account Responsibilities</h2>
            <ul className="list-disc list-inside space-y-2 ml-4 leading-relaxed">
              <li>You must be 13 years or older to create an account (18+ for NSFW content)</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You are responsible for all activity under your account</li>
              <li>You must not share your account credentials</li>
              <li>You must provide accurate information during registration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">6. Content Moderation</h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Roomlet reserves the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Remove content that violates these terms</li>
                <li>Suspend or terminate accounts for violations</li>
                <li>Report illegal content to appropriate authorities</li>
                <li>Update content guidelines as needed</li>
              </ul>
              <p className="mt-4">
                <strong className="text-white">Reporting:</strong> If you see content that violates these terms, 
                please use the report button (🚩) on any section or profile to alert moderators.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">7. Privacy & Data</h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Your privacy matters. We:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Store uploaded images securely on Cloudflare R2</li>
                <li>Use Supabase for authentication and database</li>
                <li>Do not sell your personal data to third parties</li>
                <li>Collect minimal analytics to improve the platform</li>
                <li>Allow you to delete your account and content at any time</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">8. Service Availability</h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Roomlet is provided "as is" without warranties:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We strive for 99.9% uptime but cannot guarantee uninterrupted service</li>
                <li>We may perform maintenance with or without notice</li>
                <li>We are not liable for any data loss (please keep backups)</li>
                <li>We reserve the right to modify or discontinue features</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">9. Limitation of Liability</h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Roomlet and its operators shall not be liable for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Any indirect, incidental, or consequential damages</li>
                <li>Loss of profits, data, or goodwill</li>
                <li>Content uploaded by other users</li>
                <li>Third-party actions or content</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">10. Changes to Terms</h2>
            <p className="leading-relaxed">
              We may update these Terms of Service from time to time. Changes will be posted on this page 
              with an updated "Last Updated" date. Continued use of Roomlet after changes constitutes 
              acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-white mb-4">11. Contact</h2>
            <p className="leading-relaxed">
              If you have questions about these terms or need to report a violation, please use the 
              report system (🚩 button) or contact the platform administrators.
            </p>
          </section>

          <section className="border-t border-gray-800 pt-8 mt-12">
            <p className="text-sm text-gray-500 leading-relaxed">
              By using Roomlet, you acknowledge that you have read, understood, and agree to be bound 
              by these Terms of Service. You also acknowledge that you are at least 18 years old if you 
              intend to view or upload NSFW content.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
