import dynamic from "next/dynamic";
import { LucideProps, LoaderPinwheel } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";

interface IconProps extends LucideProps {
  name: keyof typeof dynamicIconImports;
}

const Icon = ({ name, ...props }: IconProps) => {
  const LucideIcon = dynamic(dynamicIconImports[name], {
    loading: () => <LoaderPinwheel className="animate-spin mr-2"></LoaderPinwheel>,
  });

  return (
    <span className="inline-block ">
      <LucideIcon {...props} />
    </span>
  );
};

export { Icon };
