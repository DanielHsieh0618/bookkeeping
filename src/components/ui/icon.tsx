import dynamic from "next/dynamic";
import { LucideProps, LoaderCircle } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";

interface IconProps extends LucideProps {
  name: keyof typeof dynamicIconImports;
}

const Icon = ({ name, ...props }: IconProps) => {
  const LucideIcon = dynamic(dynamicIconImports[name], {
    loading: () => <LoaderCircle className="animate-spin duration-500 mr-2 p-[2px]"></LoaderCircle>,
  });

  return (
    <span className="inline-block ">
      <LucideIcon {...props} />
    </span>
  );
};

export { Icon };
