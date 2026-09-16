// The slim mission line across the top. Styled for a little life: "out loud"
// struck through, "whisper it here" softly glowing, "all reward" shimmering.
export default function PurposeBar() {
  return (
    <div className="purpose-bar">
      <span className="pb-text">
        For the ones too shy to say it{' '}
        <span className="pb-strike">out loud</span> —{' '}
        <span className="pb-whisper">whisper it here.</span>
        <span className="pb-sep"> · </span>
        <span className="pb-risk">no risk,</span>{' '}
        <span className="pb-reward">high reward</span>
      </span>
    </div>
  );
}
