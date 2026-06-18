import type { ReactNode } from 'react';

const FormErrorBanner = ({children}: {children: ReactNode}) => (
    <div className="bg-red-subtle border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
        {children}
    </div>
);

export default FormErrorBanner;