import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

interface BreadcrumbItemType {
  label: string;
  href?: string;
}

interface SindicoBreadcrumbsProps {
  items: BreadcrumbItemType[];
}

const SindicoBreadcrumbs = ({ items }: SindicoBreadcrumbsProps) => {
  return (
    <Breadcrumb className="mb-4 sm:mb-6 overflow-hidden">
      <BreadcrumbList className="flex-nowrap overflow-x-auto no-scrollbar pb-1">
        <BreadcrumbItem className="flex-shrink-0">
          <BreadcrumbLink asChild>
            <Link to="/dashboard" className="flex items-center gap-1.5 whitespace-nowrap">
              <Home className="w-3.5 h-3.5" />
              Dashboard
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5 sm:gap-2.5">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link to={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default SindicoBreadcrumbs;
