import icon from "../../assets/icon.png";

function HermesLogo({ size = 32 }: { size?: number }): React.JSX.Element {
  return (
    <img
      src={icon}
      height={size}
      style={{ objectFit: "contain" }}
      alt="Hermes"
    />
  );
}

export default HermesLogo;
