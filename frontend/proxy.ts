import { NextResponse } from "next/server";

export const proxy = () => {
  return NextResponse.next();
};

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/createsessions/:path*",
    "/createpolls/:path*",
  ],
};
