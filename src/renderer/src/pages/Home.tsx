import { memo } from 'react';

export const Home = memo(() => {
  return (
    <div>
      <h1>首页</h1>
    </div>
  );
});

Home.displayName = 'Home';
